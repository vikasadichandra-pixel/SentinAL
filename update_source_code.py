import os
import re

# Dynamically resolve workspace root path
workspace_dir = os.path.dirname(os.path.abspath(__file__))
output_file = os.path.join(workspace_dir, "COMPLETE_SOURCE_CODE.md")

# Format workspace path for file:/// URLs
url_workspace_dir = workspace_dir.replace('\\', '/')
if url_workspace_dir.startswith('/'):
    # Unix style
    url_base = f"file://{url_workspace_dir}"
else:
    # Windows style
    url_base = f"file:///{url_workspace_dir}"

groups = {
    "Root Configuration Files": [
        ".gitattributes",
        ".gitignore",
        "settings.json"
    ],
    "SentinAL Backend (Django & AI Engine)": [
        "SentinAL_Backend/.env",
        "SentinAL_Backend/ai_engine/__init__.py",
        "SentinAL_Backend/ai_engine/fuzzy_matcher.py",
        "SentinAL_Backend/ai_engine/gemini_client.py",
        "SentinAL_Backend/ai_engine/logic_gate.py",
        "SentinAL_Backend/ai_engine/prompts.py",
        "SentinAL_Backend/api/__init__.py",
        "SentinAL_Backend/api/admin.py",
        "SentinAL_Backend/api/apps.py",
        "SentinAL_Backend/api/migrations/0001_initial.py",
        "SentinAL_Backend/api/migrations/0002_contract_official_runtime.py",
        "SentinAL_Backend/api/migrations/0003_territory_remove_contract_allowed_territory_and_more.py",
        "SentinAL_Backend/api/migrations/0004_contract_release_date_alter_violation_breach_type.py",
        "SentinAL_Backend/api/migrations/0005_whitelisteddomain_alter_violation_status.py",
        "SentinAL_Backend/api/migrations/__init__.py",
        "SentinAL_Backend/api/models.py",
        "SentinAL_Backend/api/serializers.py",
        "SentinAL_Backend/api/tests.py",
        "SentinAL_Backend/api/urls.py",
        "SentinAL_Backend/api/utils.py",
        "SentinAL_Backend/api/views.py",
        "SentinAL_Backend/auto_crawler.py",
        "SentinAL_Backend/manage.py",
        "SentinAL_Backend/seed_whitelist.py",
        "SentinAL_Backend/sentinal_core/__init__.py",
        "SentinAL_Backend/sentinal_core/asgi.py",
        "SentinAL_Backend/sentinal_core/settings.py",
        "SentinAL_Backend/sentinal_core/urls.py",
        "SentinAL_Backend/sentinal_core/wsgi.py",
        "SentinAL_Backend/test_attack.py",
        "SentinAL_Backend/utils/__init__.py",
        "SentinAL_Backend/utils/pdf_generator.py"
    ],
    "SentinAL Crawler & Watcher": [
        "SentinAL_Crawler/.gitignore",
        "SentinAL_Crawler/java_crawler/Sentinel.java",
        "SentinAL_Crawler/mock_site/demo_server.py",
        "SentinAL_Crawler/mock_site/pirate-site.html",
        "SentinAL_Crawler/python_watcher/watcher.py",
        "SentinAL_Crawler/sentinel.py"
    ],
    "SentinAL Frontend (Vite + React)": [
        "sentinal-frontend/.env",
        "sentinal-frontend/.gitignore",
        "sentinal-frontend/README.md",
        "sentinal-frontend/eslint.config.js",
        "sentinal-frontend/index.html",
        "sentinal-frontend/package.json",
        "sentinal-frontend/settings.json",
        "sentinal-frontend/src/App.css",
        "sentinal-frontend/src/App.jsx",
        "sentinal-frontend/src/assets/globe.json",
        "sentinal-frontend/src/components/ActionConsole.jsx",
        "sentinal-frontend/src/components/LiveThreatLog.jsx",
        "sentinal-frontend/src/components/MapVisualizer.jsx",
        "sentinal-frontend/src/components/VerifyModal.jsx",
        "sentinal-frontend/src/components/ViolationCard.jsx",
        "sentinal-frontend/src/components/ui/Globe.jsx",
        "sentinal-frontend/src/hooks/useViolations.js",
        "sentinal-frontend/src/index.css",
        "sentinal-frontend/src/main.jsx",
        "sentinal-frontend/src/mocks/violations.js",
        "sentinal-frontend/src/services/api.js",
        "sentinal-frontend/src/utils/cn.js",
        "sentinal-frontend/src/utils/geo.js",
        "sentinal-frontend/vite.config.js"
    ]
}

def make_anchor(rel_path):
    val = rel_path.lower()
    val = re.sub(r'[^a-z0-9]', '_', val)
    return f"file-{val}"

def get_language(rel_path):
    ext = os.path.splitext(rel_path)[1].lower()
    if ext == '.py':
        return 'python'
    elif ext == '.java':
        return 'java'
    elif ext == '.html':
        return 'html'
    elif ext == '.css':
        return 'css'
    elif ext in ['.js', '.jsx']:
        return 'jsx'
    elif ext == '.json':
        return 'json'
    elif ext == '.md':
        return 'markdown'
    else:
        return 'text'

# Total file count
total_files = sum(len(files) for files in groups.values())

with open(output_file, "w", encoding="utf-8", newline="\r\n") as out:
    out.write("# SentinAL Complete Source Code Repository Document\n\n")
    out.write(f"This document contains the complete, un-truncated source code for all **{total_files} files** across the SentinAL repository.\n\n")
    out.write("## Table of Contents\n\n")
    for group_name, files in groups.items():
        out.write(f"### {group_name}\n")
        for f in files:
            anchor = make_anchor(f)
            out.write(f"- [{f}](#{anchor})\n")
        out.write("\n")
    out.write("---\n\n")
    for group_name, files in groups.items():
        out.write(f"# {group_name}\n\n")
        for f in files:
            anchor = make_anchor(f)
            full_path = os.path.join(workspace_dir, f.replace('/', os.sep))
            if os.path.exists(full_path):
                with open(full_path, "r", encoding="utf-8", errors="replace") as file_in:
                    content = file_in.read()
            else:
                content = ""
                print(f"Warning: File {f} does not exist")
            
            # Normalize newlines
            content = content.replace('\r\n', '\n')
            line_count = len(content.splitlines())
            lang = get_language(f)
            
            out.write(f'<a id="{anchor}"></a>\n')
            out.write(f"## File: [{f}]({url_base}/{f}) ({line_count} lines)\n\n")
            out.write(f"```{lang}\n")
            if content:
                out.write(content)
                if not content.endswith('\n'):
                    out.write('\n')
            else:
                out.write('\n')
            out.write("```\n\n")
            out.write("---\n\n")

print(f"Successfully generated {output_file} with {total_files} files.")
