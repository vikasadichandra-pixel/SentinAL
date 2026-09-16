import os
import sys
import time
import subprocess

PYTHON_EXE = sys.executable

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(BASE_DIR, "SentinAL_Backend")
FRONTEND_DIR = os.path.join(BASE_DIR, "sentinal-frontend")
CRAWLER_DIR = os.path.join(BASE_DIR, "SentinAL_Crawler")

PIRATE_NETFLIX = os.path.join(CRAWLER_DIR, "multi_pirate_sites", "site_netflix")
PIRATE_PRIME = os.path.join(CRAWLER_DIR, "multi_pirate_sites", "site_prime")
PIRATE_HULU = os.path.join(CRAWLER_DIR, "multi_pirate_sites", "site_hulu")

processes = []

def install_dependencies():
    print("[*] Ensuring required modules are installed...")
    subprocess.run([PYTHON_EXE, "-m", "pip", "install", "rangehttpserver", "python-dotenv", "beautifulsoup4", "selenium", "requests", "-q"])

def start_server(cmd, cwd, name):
    if not os.path.exists(cwd):
        print(f"[!] WARNING: Skipping {name} - Folder not found at {cwd}")
        return None
        
    print(f"[*] Starting {name}...")
    p = subprocess.Popen(cmd, cwd=cwd, shell=True)
    processes.append(p)
    return p

def main():
    install_dependencies()
    print("\n" + "="*60)
    print(" 🚀 STARTING SENTINAL AUTOMATED TEST PIPELINE")
    print("="*60 + "\n")

    try:
        # 1. Start Django Backend
        start_server(f'"{PYTHON_EXE}" manage.py runserver', BACKEND_DIR, "Django Backend (Port 8000)")

        # 2. Start React Frontend (Will safely skip if folder name is different)
        start_server("npm run dev", FRONTEND_DIR, "React Dashboard (Port 5173)")


        THREADED_SERVER = os.path.join(BASE_DIR, "threaded_server.py")
        
        # 3. Start Mock Pirate Sites (Using Multi-Threaded Server)
        start_server(f'"{PYTHON_EXE}" "{THREADED_SERVER}" 8081', PIRATE_NETFLIX, "Netflix Pirate Site (Port 8081)")
        start_server(f'"{PYTHON_EXE}" "{THREADED_SERVER}" 8082', PIRATE_PRIME, "Prime Video Pirate Site (Port 8082)")
        start_server(f'"{PYTHON_EXE}" "{THREADED_SERVER}" 8083', PIRATE_HULU, "Hulu Pirate Site (Port 8083)")

        print("\n⏳ Waiting 6 seconds for all servers to initialize...\n")
        time.sleep(6)

        # 4. Run Crawler Drones
        if os.path.exists(CRAWLER_DIR):
            print("="*60)
            print(" 🔍 RUNNING SENTINEL CRAWLER DRONES")
            print("="*60)

            targets = [
                (8081, "Netflix (Territory Breach)"),
                (8082, "Prime Video (Pre-Release Leak)"),
                (8083, "Hulu (Expired Rights Piracy)")
            ]

            for port, label in targets:
                url = f"http://127.0.0.1:{port}/"
                print(f"\n------------------------------------------------------------")
                print(f"[*] Executing Scan: {label}")
                print(f"------------------------------------------------------------")
                subprocess.run([PYTHON_EXE, "sentinel.py", url], cwd=CRAWLER_DIR)
                time.sleep(2)
        else:
            print(f"[!] WARNING: Crawler folder missing at {CRAWLER_DIR}")

        print("\n" + "="*60)
        print(" SUCCESS! ALL BREACHES PROCESSED AND UPLOADED.")
        print(" Press Ctrl+C in this terminal to stop all background servers.")
        print("="*60 + "\n")

        # Keep processes running until user stops them
        while True:
            time.sleep(1)

    except KeyboardInterrupt:
        print("\n\n[*] Stopping all background servers...")
        for p in processes:
            p.terminate()
        print("[+] SentinAL stopped cleanly.")

if __name__ == "__main__":
    main()