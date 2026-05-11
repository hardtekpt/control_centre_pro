#!/usr/bin/env python3
"""
Arctis Nova Pro HID Service.
Runs as a subprocess of the Electron main process.
Emits newline-delimited JSON to stdout; any Python tracebacks go to stderr.
Accepts write commands as newline-delimited JSON on stdin.
"""
import sys
import json
import time
import threading


def emit(obj: dict) -> None:
    print(json.dumps(obj), flush=True)


def log(level: str, message: str) -> None:
    emit({"type": "log", "level": level, "message": message})


# ─── Shared headset reference (protected by lock) ──────────────────────────────

_headset = None
_headset_lock = threading.Lock()


def _set_headset(h) -> None:
    global _headset
    with _headset_lock:
        _headset = h


def _clear_headset() -> None:
    global _headset
    with _headset_lock:
        _headset = None


# ─── Initial full state read ──────────────────────────────────────────────────

def _attr(obj, *names, default=None, transform=None):
    """Return the first attribute that exists on obj, applying transform if given."""
    for name in names:
        val = getattr(obj, name, None)
        if val is not None:
            return transform(val) if transform else val
    if default is not None:
        return default
    return None


def _read_full_state(headset) -> dict:
    """Read all available state from the headset and return as a flat dict.

    Every field is fetched defensively so an unexpected attribute name on any
    data object never crashes the service — it falls back to a safe default and
    logs a warning for the first occurrence.
    """
    status = headset.get_status()
    mic_eq = headset.get_mic_eq()

    # get_display() may not exist on all firmware versions
    display = None
    try:
        display = headset.get_display()
    except Exception as exc:
        log("warn", f"get_display() unavailable: {exc}")

    def enum_name(obj, *attrs, default="OFF"):
        for a in attrs:
            val = getattr(obj, a, None)
            if val is not None:
                return getattr(val, "name", str(val))
        return default

    state = {
        # ── Always-available status fields ───────────────────────────────────
        "batteryHeadset": getattr(status, "headset_battery_pct", 0),
        "batteryDock":    getattr(status, "dock_battery_pct", 0),
        "micMuted":       getattr(status, "mic_muted", getattr(status, "mic_mute", False)),
        "volume":         getattr(mic_eq, "volume_pct", 0),
        # ── Connectivity ────────────────────────────────────────────────────
        "wirelessConnected": True,
        "btActive": getattr(status, "bt_active", False),
        # ── ANC ─────────────────────────────────────────────────────────────
        "ancMode":          enum_name(status, "anc_mode", default="OFF"),
        "transparencyLevel": 5,
        # ── Audio Options ────────────────────────────────────────────────────
        "micGain":   enum_name(mic_eq, "gain", default="LOW"),
        "sidetone":  enum_name(mic_eq, "sidetone", default="OFF"),
        "micVolume": getattr(mic_eq, "mic_volume", 5),
        # ── Wireless ─────────────────────────────────────────────────────────
        "wirelessMode": enum_name(status, "wireless_mode", default="PERFORMANCE"),
        "btDefault":    getattr(status, "bt_default", False),
        "btAutoMute":   enum_name(status, "bt_auto_mute", default="OFF"),
        # ── ChatMix (hardware dial — events update this live) ────────────────
        "chatmixGame": getattr(mic_eq, "chatmix_game", 50),
        "chatmixChat": getattr(mic_eq, "chatmix_chat", 50),
        # ── Audio Output ──────────────────────────────────────────────────────
        "audioOutput": enum_name(mic_eq, "audio_output", default="SPEAKERS"),
        "streamMain":  getattr(mic_eq, "stream_main", getattr(mic_eq, "main", 100)),
        "streamAux":   getattr(mic_eq, "stream_aux",  getattr(mic_eq, "aux",  100)),
        "streamMic":   getattr(mic_eq, "stream_mic",  getattr(mic_eq, "mic",  100)),
        # ── Base Station (from display object if available) ───────────────────
        "oledBrightness": getattr(display, "oled_brightness", 5) if display else 5,
        "dimTimeout":     enum_name(display, "dim_timeout", default="OFF") if display else "OFF",
        "homescreenMode": enum_name(display, "home_screen_mode", default="DETAILED") if display else "DETAILED",
        "micLedBrightness": getattr(status, "mic_led_brightness", 5),
        "autoOffTimeout": enum_name(status, "auto_off_timeout", default="OFF"),
    }

    # Log any fields that fell back to defaults so we can spot wrong attr names
    _warn_defaults(state, mic_eq, status, display)
    return state


def _warn_defaults(state, mic_eq, status, display) -> None:
    """Emit a single grouped warning if any fields couldn't be read from the device."""
    missing = []
    if state["chatmixGame"] == 50 and not hasattr(mic_eq, "game_volume"):
        missing.append("chatmixGame (game_volume missing from MicEqData)")
    if state["chatmixChat"] == 50 and not hasattr(mic_eq, "chat_volume"):
        missing.append("chatmixChat (chat_volume missing from MicEqData)")
    if state["streamMain"] == 100 and not hasattr(mic_eq, "stream_main"):
        missing.append("streamMain (stream_main missing from MicEqData)")
    if missing:
        log("warn", "Some fields fell back to defaults — attr names may differ: " + ", ".join(missing))


# ─── Write command dispatch ────────────────────────────────────────────────────

def _handle_cmd(cmd: str, value) -> None:
    with _headset_lock:
        h = _headset
    if h is None:
        log("warn", f"Ignored '{cmd}': no device connected")
        return

    if cmd == "refresh":
        try:
            state = _read_full_state(h)
            emit({"type": "connected", "data": state})
            log("info", "State refreshed")
        except Exception as exc:
            log("error", f"Refresh failed: {exc}")
        return

    try:
        from arctis_hid import (
            AncMode, GainLevel, SidetoneLevel, AudioOutput,
            WirelessMode, BtAutoMute, TimeoutStep, HomeScreenMode,
        )

        if cmd == "setVolume":
            h.set_volume(float(value))

        elif cmd == "setAncMode":
            h.set_anc_mode(AncMode[str(value)])

        elif cmd == "setTransparencyLevel":
            h.set_transparency_level(int(value))

        elif cmd == "setMicGain":
            h.set_gain(GainLevel[str(value)])

        elif cmd == "setSidetone":
            h.set_sidetone(SidetoneLevel[str(value)])

        elif cmd == "setMicVolume":
            h.set_mic_volume(int(value))

        elif cmd == "setWirelessMode":
            h.set_wireless_mode(WirelessMode[str(value)])

        elif cmd == "setBtDefault":
            h.set_bt_default(bool(value))

        elif cmd == "setBtAutoMute":
            h.set_bt_auto_mute(BtAutoMute[str(value)])

        elif cmd == "setAudioOutput":
            h.set_audio_output(AudioOutput[str(value)])

        elif cmd == "setStreamVolumes":
            h.set_stream_volumes(int(value["main"]), int(value["aux"]), int(value["mic"]))

        elif cmd == "setOledBrightness":
            h.set_oled_brightness(int(value))

        elif cmd == "setDimTimeout":
            h.set_dim_timeout(TimeoutStep[str(value)])

        elif cmd == "setHomeScreenMode":
            h.set_home_screen_mode(HomeScreenMode[str(value)])

        elif cmd == "setMicLedBrightness":
            h.set_mic_led_brightness(int(value))

        elif cmd == "setAutoOffTimeout":
            h.set_auto_off_timeout(TimeoutStep[str(value)])

        elif cmd == "setChatmixEnabled":
            h.set_chatmix_enabled(bool(value))

        else:
            log("warn", f"Unknown command: {cmd}")

    except KeyError as exc:
        log("error", f"'{cmd}': invalid enum value {exc}")
    except AttributeError:
        log("warn", f"'{cmd}' not supported by this firmware/library version")
    except Exception as exc:
        log("error", f"'{cmd}' failed: {exc}")


def _stdin_reader() -> None:
    """Read JSON commands from stdin in a background daemon thread."""
    for raw in sys.stdin:
        raw = raw.strip()
        if not raw:
            continue
        try:
            msg = json.loads(raw)
            _handle_cmd(msg.get("cmd", ""), msg.get("value"))
        except json.JSONDecodeError:
            pass
        except Exception as exc:
            log("error", f"Stdin error: {exc}")


# ─── Main loop ────────────────────────────────────────────────────────────────

def main() -> None:
    log("info", "Arctis Nova Pro HID service starting")

    try:
        from arctis_hid import discover, DeviceNotFoundError, DeviceIOError
        from arctis_hid import (
            VolumeEvent, BatteryEvent, AncModeEvent, MicMuteEvent,
            ConnectivityEvent, ChatMixEvent, GainEvent, MicVolumeEvent,
            SidetoneEvent, OledBrightnessEvent, TransparencyEvent,
            WirelessModeEvent, BtDefaultEvent, BtAutoMuteEvent,
            AudioOutputEvent, StreamVolumesEvent, DimTimeoutEvent,
            HomeScreenEvent, MicLedEvent, AutoOffEvent,
        )
    except ImportError as exc:
        emit({"type": "fatal", "message": (
            f"arctis_hid package not found: {exc}. "
            f"Install it with: {sys.executable} -m pip install "
            f"git+https://github.com/hardtekpt/arctis_nova_pro_hid.git@development"
        )})
        sys.exit(1)

    # Start stdin command reader (daemon — dies with main thread)
    threading.Thread(target=_stdin_reader, daemon=True).start()

    while True:
        headset = None
        try:
            headset = discover()
        except DeviceNotFoundError:
            emit({"type": "disconnected"})
            time.sleep(3)
            continue

        try:
            _set_headset(headset)

            # Enable ChatMix events so the hardware dial fires ChatMixEvent
            try:
                headset.set_chatmix_enabled(True)
            except Exception:
                pass

            state = _read_full_state(headset)
            emit({"type": "connected", "data": state})
            log("info", "Headset connected — listening for events")

            # ── Volume / battery / mute ──────────────────────────────────────
            headset.on("VolumeEvent", lambda e: emit({
                "type": "event", "event": "VolumeEvent",
                "data": {"volume": e.percent},
            }))
            headset.on("BatteryEvent", lambda e: emit({
                "type": "event", "event": "BatteryEvent",
                "data": {"batteryHeadset": e.headset_pct, "batteryDock": e.dock_pct},
            }))
            headset.on("MicMuteEvent", lambda e: emit({
                "type": "event", "event": "MicMuteEvent",
                "data": {"micMuted": e.muted},
            }))

            # ── Connectivity ─────────────────────────────────────────────────
            headset.on("ConnectivityEvent", lambda e: emit({
                "type": "event", "event": "ConnectivityEvent",
                "data": {"btActive": e.bt_connected, "wirelessConnected": True},
            }))

            # ── ANC ──────────────────────────────────────────────────────────
            headset.on("AncModeEvent", lambda e: emit({
                "type": "event", "event": "AncModeEvent",
                "data": {"ancMode": e.mode.name},
            }))
            headset.on("TransparencyEvent", lambda e: emit({
                "type": "event", "event": "TransparencyEvent",
                "data": {"transparencyLevel": e.level},
            }))

            # ── Audio Options ─────────────────────────────────────────────────
            headset.on("GainEvent", lambda e: emit({
                "type": "event", "event": "GainEvent",
                "data": {"micGain": e.level.name},
            }))
            headset.on("MicVolumeEvent", lambda e: emit({
                "type": "event", "event": "MicVolumeEvent",
                "data": {"micVolume": e.level},
            }))
            headset.on("SidetoneEvent", lambda e: emit({
                "type": "event", "event": "SidetoneEvent",
                "data": {"sidetone": e.level.name},
            }))

            # ── Wireless ─────────────────────────────────────────────────────
            headset.on("WirelessModeEvent", lambda e: emit({
                "type": "event", "event": "WirelessModeEvent",
                "data": {"wirelessMode": e.mode.name},
            }))
            headset.on("BtDefaultEvent", lambda e: emit({
                "type": "event", "event": "BtDefaultEvent",
                "data": {"btDefault": e.enabled},
            }))
            headset.on("BtAutoMuteEvent", lambda e: emit({
                "type": "event", "event": "BtAutoMuteEvent",
                "data": {"btAutoMute": e.mode.name},
            }))

            # ── ChatMix ──────────────────────────────────────────────────────
            headset.on("ChatMixEvent", lambda e: emit({
                "type": "event", "event": "ChatMixEvent",
                "data": {"chatmixGame": e.game, "chatmixChat": e.chat},
            }))

            # ── Audio Output ──────────────────────────────────────────────────
            headset.on("AudioOutputEvent", lambda e: emit({
                "type": "event", "event": "AudioOutputEvent",
                "data": {"audioOutput": e.output.name},
            }))
            headset.on("StreamVolumesEvent", lambda e: emit({
                "type": "event", "event": "StreamVolumesEvent",
                "data": {"streamMain": e.main, "streamAux": e.aux, "streamMic": e.mic},
            }))

            # ── Base Station ──────────────────────────────────────────────────
            headset.on("OledBrightnessEvent", lambda e: emit({
                "type": "event", "event": "OledBrightnessEvent",
                "data": {"oledBrightness": e.level},
            }))
            headset.on("DimTimeoutEvent", lambda e: emit({
                "type": "event", "event": "DimTimeoutEvent",
                "data": {"dimTimeout": e.step.name},
            }))
            headset.on("HomeScreenEvent", lambda e: emit({
                "type": "event", "event": "HomeScreenEvent",
                "data": {"homescreenMode": e.mode.name},
            }))
            headset.on("MicLedEvent", lambda e: emit({
                "type": "event", "event": "MicLedEvent",
                "data": {"micLedBrightness": e.brightness},
            }))
            headset.on("AutoOffEvent", lambda e: emit({
                "type": "event", "event": "AutoOffEvent",
                "data": {"autoOffTimeout": e.step.name},
            }))

            headset.listen()  # blocks until DeviceIOError or stop()

        except DeviceIOError:
            emit({"type": "disconnected"})
            log("info", "Headset disconnected")
        except Exception as exc:
            log("error", f"Unexpected error: {exc}")
            emit({"type": "disconnected"})
        finally:
            _clear_headset()
            if headset is not None:
                try:
                    headset.close()
                except Exception:
                    pass

        time.sleep(2)


if __name__ == "__main__":
    main()
