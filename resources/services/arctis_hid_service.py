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

def _read_full_state(headset) -> dict:
    """Read all available state from the headset and return as a flat dict."""
    from arctis_hid import AncMode, GainLevel, SidetoneLevel, AudioOutput
    from arctis_hid import WirelessMode, BtAutoMute, TimeoutStep, HomeScreenMode

    status = headset.get_status()
    mic_eq = headset.get_mic_eq()
    display = headset.get_display()

    return {
        # Status
        "batteryHeadset": status.headset_battery_pct,
        "batteryDock": status.dock_battery_pct,
        "micMuted": status.mic_mute,
        "volume": mic_eq.volume_pct,
        # Connectivity
        "wirelessConnected": True,
        "btActive": status.bt_active,
        # ANC
        "ancMode": status.anc_mode.name,
        "transparencyLevel": 5,          # not exposed by get_status; default
        # Audio Options
        "micGain": mic_eq.gain.name,
        "sidetone": mic_eq.sidetone.name,
        "micVolume": mic_eq.mic_volume,
        # Wireless
        "wirelessMode": status.wireless_mode.name,
        "btDefault": status.bt_default,
        "btAutoMute": status.bt_auto_mute.name,
        # ChatMix (hardware dial — read from mic eq)
        "chatmixGame": mic_eq.game_volume,
        "chatmixChat": mic_eq.chat_volume,
        # Audio Output
        "audioOutput": mic_eq.audio_output.name,
        "streamMain": mic_eq.stream_main,
        "streamAux": mic_eq.stream_aux,
        "streamMic": mic_eq.stream_mic,
        # Base Station
        "oledBrightness": display.oled_brightness,
        "dimTimeout": display.dim_timeout.name,
        "homescreenMode": display.home_screen_mode.name,
        "micLedBrightness": status.mic_led_brightness,
        "autoOffTimeout": status.auto_off_timeout.name,
    }


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
                "data": {"chatmixGame": e.game_volume, "chatmixChat": e.chat_volume},
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
