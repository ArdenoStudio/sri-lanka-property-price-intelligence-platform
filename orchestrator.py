import subprocess
import sys
import os
import time

def main():
    print("Ardeno Studio: Starting Python Orchestrator...")
    
    # Force PYTHONPATH to include current directory
    env = os.environ.copy()
    env["PYTHONPATH"] = f".:{env.get('PYTHONPATH', '')}"
    
    # 1. Start Scheduler
    print("Ardeno Studio: Launching Scheduler...")
    scheduler_proc = subprocess.Popen(
        [sys.executable, "-m", "scheduler.jobs"],
        env=env
    )
    
    # 2. Start API
    print("Ardeno Studio: Launching API Server...")
    api_proc = subprocess.Popen(
        [sys.executable, "api/main.py"],
        env=env
    )
    
    try:
        # Keep orchestrator alive and monitor
        while True:
            if api_proc.poll() is not None:
                print(f"FATAL: API Process crashed with exit code {api_proc.returncode}!")
                sys.exit(api_proc.returncode)
            
            if scheduler_proc.poll() is not None:
                print(f"WARNING: Scheduler crashed with exit code {scheduler_proc.returncode}!")
                # Depending on resilience, we could restart it here, but we'll just log
                
            time.sleep(5)
    except KeyboardInterrupt:
        print("Shutting down processes...")
        api_proc.terminate()
        scheduler_proc.terminate()
        sys.exit(0)

if __name__ == "__main__":
    main()
