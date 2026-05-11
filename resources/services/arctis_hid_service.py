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


# ─── Write command dispatch ────────────────────────────────────────────────────

def _handle_cmd(cmd: str, value) -> None:
    with _headset_lock:
        h = _headset
    if h is None:
        log("warn", f"Ignored '{cmd}': no device connected")
        return
    try:
        if cmd == "setAncMode":
            from arctis_hid import AncMode
            h.set_anc_mode(AncMode[str(value)])
        elif cmd == "setTransparencyLevel":
            h.set_transparency_level(int(value))
        elif cmd == "setMicGain":
            h.set_mic_gain(str(value).lower())
        elif cmd == "setSidetone":
            h.set_sidetone(str(value).lower())
        elif cmd == "setMicVolume":
            h.set_mic_volume(int(value))
        elif cmd == "setWirelessMode":
            h.set_wireless_mode(str(value).lower())
        elif cmd == "setBtDefault":
            h.set_bt_default(bool(value))
        elif cmd == "setAutoMute":
            h.set_auto_mute(str(value).lower())
        elif cmd == "setAudioOutput":
            h.set_audio_output(str(value).lower())
        elif cmd == "setStreamLevels":
            h.set_stream_levels(value["main"], value["aux"], value["mic"])
        elif cmd == "setOledBrightness":
            h.set_oled_brightness(int(value))
        elif cmd == "setDimScreen":
            h.set_dim_screen(bool(value))
        elif cmd == "setHomescreenMode":
            h.set_homescreen_mode(str(value).lower())
        elif cmd == "setMicLedBrightness":
            h.set_mic_led_brightness(int(value))
        elif cmd == "setAutoOff":
            h.set_auto_off(bool(value))
        else:
            log("warn", f"Unknown command: {cmd}")
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


# ─── Initial state reader ─────────────────────────────────────────────────────

def _read_initial_state(headset) -> dict:
    status = headset.get_status()
    mic_eq = headset.get_mic_eq()

    state = {
        # Status
        "batteryHeadset": status.headset_battery_pct,
        "batteryDock": status.dock_battery_pct,
        "ancMode": status.anc_mode.name,
        "micMuted": status.mic_muted,
        "volume": mic_eq.volume_pct,
        # Connectivity defaults (updated by ConnectivityEvent)
        "wirelessConnected": True,
        "btActive": False,
        # ANC
        "transparencyLevel": 5,
        # Audio Options defaults
        "micGain": "LOW",
        "sidetone": "OFF",
        "micVolume": 5,
        # Wireless defaults
        "wirelessMode": "SPEED",
        "btDefault": False,
        "autoMute": "OFF",
        # Audio Output defaults
        "audioOutput": "SPEAKERS",
        "streamMain": 100,
        "streamAux": 100,
        "streamMic": 100,
        # Base Station defaults
        "oledBrightness": 50,
        "dimScreen": False,
        "homescreenMode": "DEFAULT",
        "micLedBrightness": 50,
        "autoOff": True,
    }

    # Try to enrich with additional data the library may expose
    try:
        settings = headset.get_settings()
        if hasattr(settings, 'sidetone') and settings.sidetone is not None:
            name = getattr(settings.sidetone, 'name', None)
            state["sidetone"] = name if name else str(settings.sidetone).upper()
        if hasattr(settings, 'mic_gain') and settings.mic_gain is not None:
            state["micGain"] = "HIGH" if settings.mic_gain else "LOW"
        if hasattr(settings, 'wireless_mode') and settings.wireless_mode is not None:
            name = getattr(settings.wireless_mode, 'name', None)
            state["wirelessMode"] = name if name else str(settings.wireless_mode).upper()
    except Exception:
        pass

    return state


# ─── Main loop ────────────────────────────────────────────────────────────────

def main() -> None:
    log("info", "Arctis Nova Pro HID service starting")

    try:
        from arctis_hid import discover, DeviceNotFoundError, DeviceIOError
        from arctis_hid import (
            VolumeEvent, BatteryEvent, AncModeEvent,
            MicMuteEvent, ConnectivityEvent,
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
            state = _read_initial_state(headset)
            emit({"type": "connected", "data": state})
            log("info", "Headset connected — listening for events")

            headset.on("VolumeEvent", lambda e: emit({
                "type": "event", "event": "VolumeEvent",
                "data": {"volume": e.percent},
            }))
            headset.on("BatteryEvent", lambda e: emit({
                "type": "event", "event": "BatteryEvent",
                "data": {"batteryHeadset": e.headset_pct, "batteryDock": e.dock_pct},
            }))
            headset.on("AncModeEvent", lambda e: emit({
                "type": "event", "event": "AncModeEvent",
                "data": {"ancMode": e.mode.name},
            }))
            headset.on("MicMuteEvent", lambda e: emit({
                "type": "event", "event": "MicMuteEvent",
                "data": {"micMuted": e.muted},
            }))
            headset.on("ConnectivityEvent", lambda e: emit({
                "type": "event", "event": "ConnectivityEvent",
                "data": {"btActive": e.bt_active, "wirelessConnected": e.wireless},
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
