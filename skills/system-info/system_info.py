import sys
import os
import platform
import subprocess
import shutil

def get_command_output(command):
    try:
        result = subprocess.check_output(command, shell=True, stderr=subprocess.STDOUT, text=True)
        return result.strip()
    except subprocess.CalledProcessError as e:
        return f"Error executing '{command}': {e.output.strip()}"
    except Exception as e:
        return f"Error: {str(e)}"

def get_system_info():
    info = {}
    
    info['OS'] = f"{platform.system()} {platform.release()} ({platform.version()})"
    info['Architecture'] = platform.machine()
    info['Hostname'] = platform.node()
    try:
        info['User'] = os.getlogin()
    except OSError:
        info['User'] = os.environ.get('USER', 'Unknown')

    info['CWD'] = os.getcwd()

    info['Python'] = {
        'Version': sys.version.split()[0],
        'Executable': sys.executable,
        'Pip List': get_command_output("pip list --format=freeze")
    }

    info['Node.js'] = {
        'Version': get_command_output("node -v"),
        'Npm Version': get_command_output("npm -v")
    }

    # Disk space (simplified)
    try:
        usage = shutil.disk_usage("/")
        info['Disk Usage'] = {
            'Total': f"{usage.total // (2**30)} GB",
            'Used': f"{usage.used // (2**30)} GB",
            'Free': f"{usage.free // (2**30)} GB"
        }
    except Exception as e:
        info['Disk Usage'] = f"Error: {str(e)}"

    return info

if __name__ == "__main__":
    data = get_system_info()
    print("--- System Information Snapshot ---")
    for key, value in data.items():
        print(f"\n[{key}]")
        if isinstance(value, dict):
            for sub_key, sub_value in value.items():
                print(f"  {sub_key}: {sub_value}")
        else:
            print(f"  {value}")
