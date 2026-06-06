#!/usr/bin/env python3
"""
GG Sonar Service.
Runs as a subprocess of the Electron main process, wrapping the ``steelseries_gg``
package (https://github.com/hardtekpt/steelseries_gg_py) — the dedicated, tested
home for the SteelSeries GG Sonar REST protocol, mirroring how the Arctis headset
logic lives in ``arctis_nova_pro_hid``.

Protocol (newline-delimited JSON):
  stdout  {"type":"log","level":..,"message":..}      diagnostics → About terminal
          {"type":"fatal","message":..}               unrecoverable (missing package)
          {"type":"state","data":<SonarState>}        full mixer snapshot (camelCase)
          {"type":"response","id":..,"ok":..,...}      reply to a stdin command
  stdin   {"id":..,"cmd":..,"value":..}                write / query command

The emitted ``SonarState`` matches the renderer contract in src/shared/types.ts
1:1 — the package's Pydantic models round-trip to the original camelCase wire
shape via ``model_dump(by_alias=True)``, so no transformation layer is needed.
"""
import sys
import json
import time
import threading


def emit(obj: dict) -> None:
    print(json.dumps(obj), flush=True)


def log(level: str, message: str) -> None:
    emit({"type": "log", "level": level, "message": message})


# ─── Channel name mapping ──────────────────────────────────────────────────────
# Renderer SonarChannel  →  package logical channel name.
# The package re-maps these to the GG HTTP keys internally (chat→chatRender, …);
# we only need to translate the renderer's chatRender/chatCapture names.
RENDERER_TO_PKG_CHANNEL = {
    "master": "master",
    "game": "game",
    "media": "media",
    "aux": "aux",
    "chatRender": "chat",
    "chatCapture": "mic",
}

# GG /classicRedirections channel id  →  renderer SonarDeviceChannel name.
API_CHANNEL_TO_RENDERER = {"chat": "chatRender", "mic": "chatCapture"}

# How often (in poll cycles) to refresh the rarely-changing "slow" data
# (full config list, physical devices, redirections, deviceOut, linkAll).
SLOW_EVERY = 5

# Hold a just-applied mode for this long so a fast poll doesn't revert it before
# the GG backend echoes the change (ported from the old Node service).
PENDING_MODE_HOLD_S = 4.0

# Coalesce a burst of writes into a single reconcile poll this long after a wake.
COALESCE_S = 0.1


def _empty_state() -> dict:
    return {
        "available": False,
        "mode": "classic",
        "classic": None,
        "streamer": None,
        "configs": [],
        "routing": [],
        "chatMix": None,
        "audioDevices": [],
        "redirections": {},
        "deviceOut": None,
        "linkAllEnabled": False,
    }


def _normalise(raw: str) -> str:
    """Lowercase and strip one surrounding brace pair — matches the old service so
    device-id comparison is identical."""
    if raw.startswith("{"):
        raw = raw[1:]
    if raw.endswith("}"):
        raw = raw[:-1]
    return raw.lower()


class SonarService:
    def __init__(self) -> None:
        self._gg = None
        self._lock = threading.RLock()          # serialises all package (httpx) access
        self._state_lock = threading.Lock()     # guards _state for optimistic patches
        self._wake = threading.Event()          # set by commands to trigger a reconcile poll
        self._interval = 1.0
        self._force_slow = True
        self._poll_count = 0
        self._last_available = False

        self._state = _empty_state()
        self._pending_mode = None
        self._pending_mode_expiry = 0.0

        # Slow-cadence caches (refreshed every SLOW_EVERY polls or after relevant writes)
        self._configs_cache = []     # list[Config]
        self._devices_cache = []     # list[{id, name}]
        self._redir_cache = {}       # renderer channel → {id, name}
        self._device_out_cache = None
        self._link_all_cache = False
        # role → {"deviceId":.., "dataFlow":..} for routeProcess resolution
        self._routing_cache = {}

    # ── Connection ────────────────────────────────────────────────────────────

    def _connect(self) -> bool:
        try:
            self._gg = _GGClient()
            with self._lock:
                self._gg.sonar.get_status()  # triggers sub-app discovery; confirms reachable
            log("info", "Connected to GG Sonar")
            self._force_slow = True
            return True
        except _DiscoveryError:
            self._teardown()
            return False
        except _GGError as exc:
            self._teardown()
            if not self._last_available:
                log("warn", f"GG Sonar connection failed: {exc} — is GG running?")
            return False

    def _teardown(self) -> None:
        if self._gg is not None:
            try:
                with self._lock:
                    self._gg.close()
            except Exception:
                pass
        self._gg = None

    def _emit_unavailable(self) -> None:
        with self._state_lock:
            self._state = _empty_state()
            snapshot = dict(self._state)
        if self._last_available:
            log("info", "GG Sonar disconnected")
        self._last_available = False
        emit({"type": "state", "data": snapshot})

    # ── Polling ───────────────────────────────────────────────────────────────

    def _poll(self, slow: bool) -> bool:
        try:
            with self._lock:
                s = self._gg.sonar
                status = s.get_status()
                classic = s.get_classic_volumes()
                streamer = s.get_streamer_volumes()
                chatmix = s.get_chat_mix()
                routing = s.get_audio_device_routing()
                if slow:
                    configs = s.get_configs()
                    phys = s.get_physical_audio_devices()
                    redir = s.get_classic_redirections()
                    device_out = s.get_device_out()
                    link_all = s.get_link_all_enabled()
        except _DiscoveryError:
            return False
        except _GGError as exc:
            if self._last_available:
                log("warn", f"GG Sonar poll failed: {exc}")
            return False

        # ── Refresh slow caches outside the lock ────────────────────────────────
        if slow:
            self._configs_cache = configs
            self._devices_cache = self._map_devices(phys)
            self._redir_cache = self._resolve_redirections(redir, self._devices_cache)
            self._device_out_cache = device_out.model_dump(by_alias=True, exclude_none=True)
            self._link_all_cache = bool(link_all)

        # ── Mode (with pending-mode hold) ───────────────────────────────────────
        polled_mode = getattr(status.mode, "value", str(status.mode))
        now = time.monotonic()
        if self._pending_mode is not None and now < self._pending_mode_expiry:
            mode = self._pending_mode
        else:
            self._pending_mode = None
            mode = polled_mode

        # ── Selected presets from one /v1/status call (replaces /configs/selected) ─
        selected_ids = {d.config.id for d in status.devices if getattr(d, "config", None)}
        configs_out = []
        for c in self._configs_cache:
            d = c.model_dump(by_alias=True, exclude_none=True)
            d["isSelected"] = c.id in selected_ids
            configs_out.append(d)

        # ── Routing (cache role → device/dataFlow for routeProcess) ─────────────
        routing_out = [r.model_dump(by_alias=True, exclude_none=True) for r in routing]
        self._routing_cache = {
            r.role: {"deviceId": r.device_id, "dataFlow": r.data_flow} for r in routing
        }

        state = {
            "available": True,
            "mode": mode,
            "classic": classic.model_dump(by_alias=True, exclude_none=True),
            "streamer": streamer.model_dump(by_alias=True, exclude_none=True),
            "configs": configs_out,
            "routing": routing_out,
            "chatMix": chatmix.model_dump(by_alias=True, exclude_none=True),
            "audioDevices": self._devices_cache,
            "redirections": self._redir_cache,
            "deviceOut": self._device_out_cache,
            "linkAllEnabled": self._link_all_cache,
        }
        with self._state_lock:
            self._state = state
            snapshot = dict(state)
        self._last_available = True
        emit({"type": "state", "data": snapshot})
        return True

    @staticmethod
    def _map_devices(phys) -> list:
        out = []
        for d in phys:
            dev_id = getattr(d, "id", "") or ""
            name = getattr(d, "friendly_name", None) or getattr(d, "name", None) or "Unknown"
            if dev_id:
                out.append({"id": dev_id, "name": name})
        return out

    def _resolve_redirections(self, redir, devices) -> dict:
        by_norm = {_normalise(d["id"]): d for d in devices}
        by_name = {d["name"].lower(): d for d in devices}
        result = {}
        for entry in redir:
            api_channel = entry.id
            channel = API_CHANNEL_TO_RENDERER.get(api_channel, api_channel)
            raw_id = entry.device_id or ""
            if not raw_id:
                continue
            dev = by_norm.get(_normalise(raw_id)) or by_name.get(raw_id.lower())
            result[channel] = dev if dev else {"id": raw_id, "name": raw_id}
        return result

    # ── Optimistic state patches (instant UI feedback before reconcile) ─────────

    def _patch_classic(self, channel: str, patch: dict) -> None:
        with self._state_lock:
            classic = self._state.get("classic")
            if not classic:
                return
            if channel == "master":
                classic["masters"]["classic"].update(patch)
            else:
                dev = classic.get("devices", {}).get(channel)
                if dev:
                    dev["classic"].update(patch)
            snapshot = dict(self._state)
        emit({"type": "state", "data": snapshot})

    def _emit_current(self) -> None:
        with self._state_lock:
            snapshot = dict(self._state)
        emit({"type": "state", "data": snapshot})

    # ── Command dispatch ────────────────────────────────────────────────────────

    def _handle_cmd(self, cmd: str, value):
        """Execute a command; return its result data (or None). Raises on failure."""
        # Commands that don't need a live connection
        if cmd == "setPollingConfig":
            ms = int((value or {}).get("pollingIntervalMs", 1000))
            self._interval = max(0.1, ms / 1000.0)
            return None

        if self._gg is None:
            raise RuntimeError("GG Sonar not connected")
        s = self._gg.sonar

        if cmd == "setVolume":
            ch = value["channel"]
            vol = max(0.0, min(1.0, float(value["value"])))
            self._patch_classic(ch, {"volume": vol})
            with self._lock:
                s.set_classic_volume(RENDERER_TO_PKG_CHANNEL[ch], vol)
            log("info", f"{ch}: volume {round(vol * 100)}%")
            self._trigger(slow=False)
            return None

        if cmd == "setMute":
            ch = value["channel"]
            muted = bool(value["muted"])
            self._patch_classic(ch, {"muted": muted})
            with self._lock:
                s.set_classic_mute(RENDERER_TO_PKG_CHANNEL[ch], muted)
            log("info", f"{ch}: {'muted' if muted else 'unmuted'}")
            self._trigger(slow=False)
            return None

        if cmd == "setMode":
            mode = value["mode"]  # 'classic' | 'stream'
            with self._lock:
                s.set_mode(mode)
            self._pending_mode = mode
            self._pending_mode_expiry = time.monotonic() + PENDING_MODE_HOLD_S
            with self._state_lock:
                self._state["mode"] = mode
            self._emit_current()
            log("info", f"Mode: {mode}")
            self._trigger(slow=False)
            return None

        if cmd == "selectPreset":
            with self._lock:
                cfg = s.select_config(value["id"])
            log("info", f"Preset → \"{getattr(cfg, 'name', value['id'])}\"")
            self._trigger(slow=False)
            return None

        if cmd == "setRedirection":
            ch = value["channel"]  # renderer SonarDeviceChannel
            device_id = value["deviceId"]
            with self._lock:
                s.set_classic_redirection(RENDERER_TO_PKG_CHANNEL[ch], device_id)
            # Optimistic: reflect the chosen device immediately
            dev = next((d for d in self._devices_cache if d["id"] == device_id), None)
            if dev:
                with self._state_lock:
                    self._state["redirections"] = {**self._state.get("redirections", {}), ch: dev}
                self._redir_cache[ch] = dev
                self._emit_current()
            log("info", f"{ch}: route to \"{dev['name'] if dev else device_id}\"")
            self._trigger(slow=True)
            return None

        if cmd == "routeProcess":
            process_id = int(value["processId"])
            target = value["targetChannel"]
            entry = self._routing_cache.get(target)
            if not entry:
                raise RuntimeError(f"No routing channel for {target!r}")
            with self._lock:
                s.route_process(entry["dataFlow"], entry["deviceId"], process_id)
            log("info", f"Route process {process_id} → {target}")
            self._trigger(slow=False)
            return None

        if cmd == "refreshDevices":
            self._trigger(slow=True)
            return None

        if cmd == "upsertConfig":
            cfg = _Config.model_validate(value)
            with self._lock:
                res = s.upsert_config(cfg)
            self._trigger(slow=True)
            return res.model_dump(by_alias=True, exclude_none=True)

        if cmd == "deleteConfig":
            with self._lock:
                s.delete_config(value["id"])
            self._trigger(slow=True)
            return None

        if cmd == "duplicateConfig":
            source_id = value["sourceId"]
            src = next((c for c in self._configs_cache if c.id == source_id), None)
            new_name = f"{src.name} Copy" if src else None
            with self._lock:
                res = s.duplicate_config(source_id, new_name=new_name)
            self._trigger(slow=True)
            return res.model_dump(by_alias=True, exclude_none=True)

        if cmd == "resetConfig":
            with self._lock:
                res = s.reset_config(value["id"])
            self._trigger(slow=True)
            return res.model_dump(by_alias=True, exclude_none=True)

        if cmd == "toggleFavorite":
            with self._lock:
                s.set_config_favorite(value["id"], bool(value["isFavorite"]))
            self._trigger(slow=True)
            return None

        if cmd == "setDeviceOut":
            feature = value["feature"]  # 'HeadphoneOut' | 'LineOut'
            with self._lock:
                s.set_device_out(feature)
            if self._device_out_cache:
                with self._state_lock:
                    self._state.setdefault("deviceOut", {})
                    if self._state["deviceOut"]:
                        self._state["deviceOut"]["selectedDeviceOut"] = feature
                self._device_out_cache["selectedDeviceOut"] = feature
                self._emit_current()
            log("info", f"Output: {feature}")
            self._trigger(slow=True)
            return None

        if cmd == "setLinkAll":
            enabled = bool(value["enabled"])
            with self._lock:
                s.set_link_all_enabled(enabled)
            with self._state_lock:
                self._state["linkAllEnabled"] = enabled
            self._link_all_cache = enabled
            self._emit_current()
            log("info", f"Link volumes: {'on' if enabled else 'off'}")
            self._trigger(slow=True)
            return None

        if cmd == "getAudioSamples":
            pkg_role = RENDERER_TO_PKG_CHANNEL.get(value["role"], value["role"])
            with self._lock:
                samples = s.get_audio_samples(pkg_role)
            return [x.model_dump(by_alias=True, exclude_none=True) for x in samples]

        if cmd == "playAudioSample":
            pkg_role = RENDERER_TO_PKG_CHANNEL.get(value["role"], value["role"])
            with self._lock:
                res = s.play_audio_sample(pkg_role, value["id"])
            return [x.model_dump(by_alias=True, exclude_none=True) for x in res]

        raise RuntimeError(f"Unknown command: {cmd}")

    def _trigger(self, slow: bool) -> None:
        """Schedule a coalesced reconcile poll (optionally refreshing slow data)."""
        if slow:
            self._force_slow = True
        self._wake.set()

    # ── stdin reader (daemon) ───────────────────────────────────────────────────

    def _stdin_reader(self) -> None:
        for raw in sys.stdin:
            raw = raw.strip()
            if not raw:
                continue
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue
            req_id = msg.get("id")
            cmd = msg.get("cmd", "")
            value = msg.get("value")
            try:
                data = self._handle_cmd(cmd, value)
                if req_id is not None:
                    emit({"type": "response", "id": req_id, "ok": True, "data": data})
            except Exception as exc:
                if req_id is not None:
                    emit({"type": "response", "id": req_id, "ok": False, "error": str(exc)})
                else:
                    log("error", f"'{cmd}' failed: {exc}")

    # ── Main loop ───────────────────────────────────────────────────────────────

    def run(self) -> None:
        log("info", "GG Sonar service starting")
        threading.Thread(target=self._stdin_reader, daemon=True).start()
        self._emit_unavailable()  # render a disconnected mixer immediately

        while True:
            if self._gg is None:
                if not self._connect():
                    self._emit_unavailable()
                    self._wake.wait(timeout=3.0)
                    self._wake.clear()
                    continue

            do_slow = self._force_slow or (self._poll_count % SLOW_EVERY == 0)
            if self._poll(slow=do_slow):
                self._force_slow = False
                self._poll_count += 1
            else:
                self._teardown()
                self._emit_unavailable()

            woken = self._wake.wait(timeout=self._interval)
            self._wake.clear()
            if woken:
                time.sleep(COALESCE_S)  # let a burst of writes settle into one poll
                self._wake.clear()


def main() -> None:
    global _GGClient, _DiscoveryError, _GGError, _Config, _ConfigData
    try:
        from steelseries_gg import GGClient, DiscoveryError, SteelSeriesGGError
        from steelseries_gg.models.sonar import Config, ConfigData
    except ImportError as exc:
        emit({"type": "fatal", "message": (
            f"steelseries_gg package not found: {exc}. "
            f"Install it with: {sys.executable} -m pip install "
            f"git+https://github.com/hardtekpt/steelseries_gg_py.git"
        )})
        sys.exit(1)

    _GGClient = GGClient
    _DiscoveryError = DiscoveryError
    _GGError = SteelSeriesGGError
    _Config = Config
    _ConfigData = ConfigData

    SonarService().run()


if __name__ == "__main__":
    main()
