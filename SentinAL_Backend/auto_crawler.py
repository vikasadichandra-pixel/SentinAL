import time
import subprocess
from datetime import datetime

# Set how often you want the crawler to run (in minutes)
INTERVAL_MINUTES = 5 

print(f"[*] SentinAL Drone Active.")
print(f"[*] Scanning the web every {INTERVAL_MINUTES} minutes.")
print("[*] Press Ctrl+C to shut down the drone.\n")

while True:
    current_time = datetime.now().strftime('%H:%M:%S')
    print(f"[{current_time}] 🚀 Launching sentinel.py...")
    
    try:
        # This line presses "Enter" on your crawler for you
        subprocess.run(["python", "sentinel.py"])
    except Exception as e:
        print(f"[!] Error running crawler: {e}")
        
    print(f"[{datetime.now().strftime('%H:%M:%S')}] 🛑 Scan complete. Entering sleep mode...\n")
    
    # Pause the script for the interval duration
    time.sleep(INTERVAL_MINUTES * 60)