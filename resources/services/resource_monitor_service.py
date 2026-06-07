#!/usr/bin/env python3
"""
Resource Monitor Service.
Polls CPU, RAM, GPU, disk, and network statistics and emits them as JSON events.
Runs as a subprocess of the Electron main process.
"""
import sys
import json
import time
import threading
import subprocess
import platform

try:
    import psutil
except ImportError:
    print(json.dumps({"type": "fatal", "message": "psutil not installed. Run: pip install psutil"}), flush=True)
    sys.exit(1)


def emit(obj: dict) -> None:
    print(json.dumps(obj), flush=True)


def log(level: str, message: str) -> None:
    emit({"type": "log", "level": level, "message": message})


# ─── Interval control ─────────────────────────────────────────────────────────

_poll_interval = 2.0
_interval_lock = threading.Lock()


def get_interval() -> float:
    with _interval_lock:
        return _poll_interval


def set_interval(val: float) -> None:
    global _poll_interval
    with _interval_lock:
        _poll_interval = max(0.5, float(val))


# ─── Metrics control ──────────────────────────────────────────────────────────

_ALL_METRICS = {"cpu", "ram", "gpu", "disk", "network"}
_enabled_metrics: set = set(_ALL_METRICS)
_metrics_lock = threading.Lock()


def get_enabled_metrics() -> set:
    with _metrics_lock:
        return set(_enabled_metrics)


def set_metrics(metrics: dict) -> None:
    global _enabled_metrics
    with _metrics_lock:
        _enabled_metrics = {k for k, v in metrics.items() if v} & _ALL_METRICS


# ─── GPU detection ────────────────────────────────────────────────────────────

_IS_WINDOWS = platform.system() == "Windows"
_gpu_vendor: str = "unknown"  # "nvidia", "amd", "intel", "unknown"
_gpu_name: str = "GPU"
_gpu_total_vram_gb: float | None = None


def _run_ps(command: str, timeout: int = 5) -> str | None:
    """Run a PowerShell command and return stdout, or None on failure."""
    try:
        result = subprocess.run(
            ["powershell", "-NoProfile", "-NonInteractive", "-Command", command],
            capture_output=True, text=True, timeout=timeout
        )
        return result.stdout.strip() if result.returncode == 0 else None
    except Exception:
        return None


def _detect_gpu() -> None:
    global _gpu_vendor, _gpu_name, _gpu_total_vram_gb
    if not _IS_WINDOWS:
        return
    out = _run_ps(
        "Get-WmiObject Win32_VideoController | "
        "Select-Object -First 1 -Property Name, AdapterRAM | ConvertTo-Json -Compress"
    )
    if not out:
        return
    try:
        data = json.loads(out)
        if isinstance(data, list):
            data = data[0]
        name = data.get("Name", "") or ""
        _gpu_name = name
        adapter_ram = data.get("AdapterRAM") or 0
        if adapter_ram and adapter_ram > 0:
            _gpu_total_vram_gb = adapter_ram / (1024 ** 3)
        name_lower = name.lower()
        if "amd" in name_lower or "radeon" in name_lower or "rx " in name_lower:
            _gpu_vendor = "amd"
        elif "nvidia" in name_lower or "geforce" in name_lower or "quadro" in name_lower:
            _gpu_vendor = "nvidia"
        elif "intel" in name_lower:
            _gpu_vendor = "intel"
    except Exception:
        pass


# ─── GPU stats ────────────────────────────────────────────────────────────────

def _get_gpu_usage() -> float | None:
    """GPU 3D engine utilisation % via Windows Performance Counters (all vendors)."""
    if not _IS_WINDOWS:
        return None
    out = _run_ps(
        "try { $s = (Get-Counter '\\GPU Engine(*engtype_3D*)\\Utilization Percentage' "
        "-ErrorAction Stop).CounterSamples | Measure-Object -Property CookedValue -Sum; "
        "Write-Output $s.Sum } catch { Write-Output '' }"
    )
    if not out:
        return None
    try:
        val = float(out)
        return round(min(val, 100.0), 1)
    except Exception:
        return None


def _get_gpu_vram_used() -> float | None:
    """VRAM used in GB via Windows Performance Counters (all vendors)."""
    if not _IS_WINDOWS:
        return None
    out = _run_ps(
        "try { $s = (Get-Counter '\\GPU Local Adapter Memory(*)\\Local Adapter Memory' "
        "-ErrorAction Stop).CounterSamples | Measure-Object -Property CookedValue -Sum; "
        "Write-Output ($s.Sum / 1GB) } catch { Write-Output '' }"
    )
    if not out:
        return None
    try:
        return round(float(out), 2)
    except Exception:
        return None


def _get_gpu_temp_nvidia() -> float | None:
    try:
        result = subprocess.run(
            ["nvidia-smi", "--query-gpu=temperature.gpu", "--format=csv,noheader,nounits"],
            capture_output=True, text=True, timeout=3
        )
        if result.returncode == 0:
            return float(result.stdout.strip().split("\n")[0])
    except Exception:
        pass
    return None


def _get_gpu_temp_amd_ctypes() -> float | None:
    """AMD GPU temperature via ADL ctypes — works with AMD drivers, no extra packages needed."""
    try:
        import ctypes

        try:
            adl = ctypes.WinDLL("atiadlxx.dll")  # 64-bit AMD ADL
        except OSError:
            try:
                adl = ctypes.WinDLL("atiadlxy.dll")  # 32-bit fallback
            except OSError:
                return None

        ADL_MAIN_MALLOC = ctypes.CFUNCTYPE(ctypes.c_void_p, ctypes.c_int)
        _bufs: list = []

        def _malloc(size: int) -> int:
            buf = ctypes.create_string_buffer(size)
            _bufs.append(buf)
            return ctypes.cast(buf, ctypes.c_void_p).value or 0

        malloc_fn = ADL_MAIN_MALLOC(_malloc)
        context = ctypes.c_void_p()

        if adl.ADL2_Main_Control_Create(malloc_fn, 1, ctypes.byref(context)) != 0:
            return None

        try:
            num = ctypes.c_int()
            if adl.ADL2_Adapter_NumberOfAdapters_Get(context, ctypes.byref(num)) != 0:
                return None

            for i in range(num.value):
                active = ctypes.c_int()
                adl.ADL2_Adapter_Active_Get(context, i, ctypes.byref(active))
                if not active.value:
                    continue

                # Try OverdriveN (Navi / RX 5000+, RX 6000+, RX 7000+)
                temp_raw = ctypes.c_int()
                try:
                    if adl.ADL2_OverdriveN_Temperature_Get(context, i, 1, ctypes.byref(temp_raw)) == 0:
                        t = temp_raw.value
                        # API returns millidegrees on some drivers, direct °C on others
                        celsius = t / 1000.0 if t > 200 else float(t)
                        if 0 < celsius < 150:
                            return round(celsius, 1)
                except Exception:
                    pass

                # Fallback: Overdrive5 (older architecture)
                class ADLTemperature(ctypes.Structure):
                    _fields_ = [("iSize", ctypes.c_int), ("iTemperature", ctypes.c_int)]

                t5 = ADLTemperature()
                t5.iSize = ctypes.sizeof(ADLTemperature)
                try:
                    if adl.ADL2_Overdrive5_Temperature_Get(context, i, 0, ctypes.byref(t5)) == 0:
                        raw = t5.iTemperature
                        celsius = raw / 1000.0 if raw > 200 else float(raw)
                        if 0 < celsius < 150:
                            return round(celsius, 1)
                except Exception:
                    pass

        finally:
            try:
                adl.ADL2_Main_Control_Destroy(context)
            except Exception:
                pass
    except Exception:
        pass
    return None


def _get_gpu_temp() -> float | None:
    if _gpu_vendor == "nvidia":
        return _get_gpu_temp_nvidia()
    if _gpu_vendor == "amd":
        # Try ctypes ADL first (no extra packages), pyadl as fallback if installed
        temp = _get_gpu_temp_amd_ctypes()
        if temp is not None:
            return temp
        try:
            import pyadl  # type: ignore
            devices = pyadl.ADLManager.getInstance().getDevices()
            if devices:
                t = devices[0].getCurrentTemperature()
                if t is not None:
                    return float(t)
        except Exception:
            pass
    return None


# ─── CPU temperature ──────────────────────────────────────────────────────────

def _get_cpu_temp() -> float | None:
    # psutil sensors (Linux / macOS)
    try:
        sensors = psutil.sensors_temperatures()
        if sensors:
            for key in ("coretemp", "k10temp", "zenpower", "cpu_thermal", "acpitz"):
                entries = sensors.get(key, [])
                if entries:
                    return round(entries[0].current, 1)
    except Exception:
        pass
    if not _IS_WINDOWS:
        return None

    # Windows: try thermal zone performance counter first (more reliable on Ryzen)
    out = _run_ps(
        "try { $s = (Get-Counter '\\Thermal Zone Information(*)\\Temperature' "
        "-ErrorAction Stop).CounterSamples | Measure-Object -Property CookedValue -Maximum; "
        # Counter returns Kelvin; subtract 273.15 for Celsius
        "Write-Output ($s.Maximum - 273.15) } catch { Write-Output '' }"
    )
    if out:
        try:
            t = round(float(out), 1)
            if 0 < t < 120:
                return t
        except Exception:
            pass

    # Windows: ACPI WMI fallback (tenths of Kelvin)
    out = _run_ps(
        "try { $t = (Get-WmiObject -Namespace root\\wmi "
        "-Class MSAcpi_ThermalZoneTemperature -ErrorAction Stop).CurrentTemperature; "
        "Write-Output (($t | Measure-Object -Minimum).Minimum / 10 - 273.15) } "
        "catch { Write-Output '' }"
    )
    if out:
        try:
            t = round(float(out), 1)
            if 0 < t < 120:
                return t
        except Exception:
            pass

    return None


# ─── Disk I/O rate tracking ───────────────────────────────────────────────────

_prev_disk_io: dict = {}
_prev_disk_time: float = 0.0


def _get_disk_stats() -> list:
    global _prev_disk_io, _prev_disk_time

    now = time.monotonic()
    elapsed = now - _prev_disk_time if _prev_disk_time else 1.0
    _prev_disk_time = now

    try:
        current_io = psutil.disk_io_counters(perdisk=True) or {}
    except Exception:
        current_io = {}

    result = []
    try:
        partitions = psutil.disk_partitions(all=False)
    except Exception:
        partitions = []

    seen_devices = set()
    for part in partitions:
        try:
            usage = psutil.disk_usage(part.mountpoint)
        except Exception:
            continue

        device = part.device.replace("\\", "/").rstrip("/").split("/")[-1]
        if device in seen_devices:
            continue
        seen_devices.add(device)

        # I/O rates
        read_mbps = 0.0
        write_mbps = 0.0
        cur = current_io.get(device) or current_io.get(part.device)
        prev = _prev_disk_io.get(device)
        if cur and prev and elapsed > 0:
            read_mbps = round((cur.read_bytes - prev.read_bytes) / (1024 ** 2) / elapsed, 2)
            write_mbps = round((cur.write_bytes - prev.write_bytes) / (1024 ** 2) / elapsed, 2)
            read_mbps = max(0.0, read_mbps)
            write_mbps = max(0.0, write_mbps)
        if cur:
            _prev_disk_io[device] = cur

        label = part.mountpoint
        result.append({
            "mountpoint": part.mountpoint,
            "label": label,
            "usedPercent": round(usage.percent, 1),
            "usedGb": round(usage.used / (1024 ** 3), 2),
            "totalGb": round(usage.total / (1024 ** 3), 2),
            "readMbps": read_mbps,
            "writeMbps": write_mbps,
        })
    return result


# ─── Network I/O rate tracking ────────────────────────────────────────────────

_prev_net_io: dict = {}
_prev_net_time: float = 0.0
_SKIP_NET_ADAPTERS = {"lo", "loopback", "localhost"}


def _get_net_stats() -> list:
    global _prev_net_io, _prev_net_time

    now = time.monotonic()
    elapsed = now - _prev_net_time if _prev_net_time else 1.0
    _prev_net_time = now

    try:
        current_io = psutil.net_io_counters(pernic=True) or {}
    except Exception:
        return []

    result = []
    for adapter, cur in current_io.items():
        if adapter.lower() in _SKIP_NET_ADAPTERS:
            continue
        prev = _prev_net_io.get(adapter)
        sent_mbps = 0.0
        recv_mbps = 0.0
        if prev and elapsed > 0:
            sent_mbps = round((cur.bytes_sent - prev.bytes_sent) / (1024 ** 2) / elapsed, 3)
            recv_mbps = round((cur.bytes_recv - prev.bytes_recv) / (1024 ** 2) / elapsed, 3)
            sent_mbps = max(0.0, sent_mbps)
            recv_mbps = max(0.0, recv_mbps)
        _prev_net_io[adapter] = cur
        # Only include adapters with any traffic
        if prev is not None:
            result.append({
                "adapter": adapter,
                "sentMbps": sent_mbps,
                "recvMbps": recv_mbps,
            })
    return result


# ─── Snapshot collection ──────────────────────────────────────────────────────

def _collect_snapshot() -> dict:
    enabled = get_enabled_metrics()

    # CPU
    cpu_info: dict | None = None
    cpu_temp: float | None = None
    if "cpu" in enabled:
        cpu_percent = psutil.cpu_percent(interval=None)
        core_usage = psutil.cpu_percent(interval=None, percpu=True)
        cpu_temp = _get_cpu_temp()
        cpu_info = {
            "usagePercent": round(cpu_percent, 1),
            "coreUsage": [round(c, 1) for c in (core_usage if isinstance(core_usage, list) else [cpu_percent])],
            "temperatureCelsius": cpu_temp,
        }
    else:
        # Still drain psutil's internal counters so re-enabling gives valid deltas
        psutil.cpu_percent(interval=None)
        psutil.cpu_percent(interval=None, percpu=True)

    # RAM
    ram_info: dict | None = None
    if "ram" in enabled:
        mem = psutil.virtual_memory()
        swap = psutil.swap_memory()
        ram_info = {
            "usedPercent": round(mem.percent, 1),
            "usedGb": round(mem.used / (1024 ** 3), 2),
            "totalGb": round(mem.total / (1024 ** 3), 2),
            "swapUsedPercent": round(swap.percent, 1),
        }

    # GPU
    gpu_temp: float | None = None
    gpu_info: dict | None = None
    gpu_available = _gpu_name != "unknown" and _gpu_name != ""
    if "gpu" in enabled and gpu_available:
        gpu_usage = _get_gpu_usage()
        gpu_vram_used = _get_gpu_vram_used()
        gpu_temp = _get_gpu_temp()
        gpu_info = {
            "name": _gpu_name,
            "usagePercent": gpu_usage,
            "vramUsedGb": gpu_vram_used,
            "vramTotalGb": _gpu_total_vram_gb,
            "temperatureCelsius": gpu_temp,
        }

    # Disk
    disks = _get_disk_stats() if "disk" in enabled else []

    # Network
    network = _get_net_stats() if "network" in enabled else []

    return {
        "cpu": cpu_info,
        "ram": ram_info,
        "gpu": gpu_info,
        "disks": disks,
        "network": network,
        "gpuAvailable": gpu_available,
        "temperatureAvailable": cpu_temp is not None or gpu_temp is not None,
        "enabledMetrics": list(enabled),
    }


# ─── Stdin command reader ─────────────────────────────────────────────────────

def _stdin_thread() -> None:
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
            cmd = msg.get("cmd")
            val = msg.get("value")
            if cmd == "set-interval" and val is not None:
                set_interval(val)
                log("info", f"Poll interval set to {get_interval()} s")
            elif cmd == "set-metrics" and isinstance(val, dict):
                set_metrics(val)
                log("info", f"Enabled metrics: {sorted(get_enabled_metrics())}")
        except Exception:
            pass


# ─── Main ─────────────────────────────────────────────────────────────────────

def main() -> None:
    log("info", "Resource Monitor service starting")

    # Warm up psutil CPU measurement (first call always returns 0)
    psutil.cpu_percent(interval=None)
    psutil.cpu_percent(interval=None, percpu=True)

    # Detect GPU vendor and name
    if _IS_WINDOWS:
        _detect_gpu()
        log("info", f"GPU detected: {_gpu_name} ({_gpu_vendor})")
    else:
        log("info", "Non-Windows platform — GPU stats via PowerShell unavailable")

    # Initialise I/O baselines
    _get_disk_stats()
    _get_net_stats()

    # Small delay so I/O rate deltas are meaningful on first real snapshot
    time.sleep(1.0)

    snapshot = _collect_snapshot()
    emit({"type": "connected", "data": snapshot})

    # Start stdin command thread
    t = threading.Thread(target=_stdin_thread, daemon=True)
    t.start()

    # Main polling loop
    while True:
        interval = get_interval()
        time.sleep(interval)
        try:
            snapshot = _collect_snapshot()
            emit({"type": "event", "event": "ResourceUpdate", "data": snapshot})
        except Exception as e:
            log("error", f"Snapshot error: {e}")


if __name__ == "__main__":
    main()
