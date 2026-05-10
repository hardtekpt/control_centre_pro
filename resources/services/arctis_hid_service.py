#!/usr/bin/env python3
"""
Arctis Nova Pro HID Service.
Runs as a subprocess of the Electron main process.
Emits newline-delimited JSON to stdout; any Python tracebacks go to stderr.
"""
import sys
import json
import time


def emit(obj: dict) -> None:
    print(json.dumps(obj), flush=True)


def log(level: str, message: str) -> None:
    emit({"type": "log", "level": level, "message": message})


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

    while True:
        headset = None
        try:
            headset = discover()
        except DeviceNotFoundError:
            emit({"type": "disconnected"})
            time.sleep(3)
            continue

        try:
            status = headset.get_status()
            mic_eq = headset.get_mic_eq()

            emit({
                "type": "connected",
                "data": {
                    "batteryHeadset": status.headset_battery_pct,
                    "batteryDock": status.dock_battery_pct,
                    "ancMode": status.anc_mode.name,
                    "micMuted": status.mic_muted,
                    "volume": mic_eq.volume_pct,
                },
            })
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
                "data": {"btActive": e.bt_active, "wireless": e.wireless},
            }))

            headset.listen()  # blocks until DeviceIOError or stop()

        except DeviceIOError:
            emit({"type": "disconnected"})
            log("info", "Headset disconnected")
        except Exception as exc:
            log("error", f"Unexpected error: {exc}")
            emit({"type": "disconnected"})
        finally:
            if headset is not None:
                try:
                    headset.close()
                except Exception:
                    pass

        time.sleep(2)


if __name__ == "__main__":
    main()
