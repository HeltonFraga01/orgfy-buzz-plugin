#!/usr/bin/env python3
"""
Deploy e Ativação do OrgFy Control Room no Buzz Desktop Profile.
Calcula o SHA-256 do bundle compilado (plugin.js), cria o artefato JSON em
~/Library/Application Support/xyz.block.buzz.desktop/profiles/default/artifacts/digital.cortexx.orgfy/
e atualiza ~/Library/Application Support/xyz.block.buzz.desktop/profiles/default/registry.json.
"""

import os
import sys
import json
import hashlib

PLUGIN_DIR = os.path.expanduser("/Users/heltonfraga/.buzz/REPOS/orgfy-buzz-plugin")
MANIFEST_PATH = os.path.join(PLUGIN_DIR, "manifest.json")
PLUGIN_JS_PATH = os.path.join(PLUGIN_DIR, "plugin.js")
README_PATH = os.path.join(PLUGIN_DIR, "README.md")

PROFILE_DIR = os.path.expanduser("~/Library/Application Support/xyz.block.buzz.desktop/profiles/default")
REGISTRY_PATH = os.path.join(PROFILE_DIR, "registry.json")
ARTIFACTS_DIR = os.path.join(PROFILE_DIR, "artifacts", "digital.cortexx.orgfy")

def main():
    if not os.path.exists(MANIFEST_PATH) or not os.path.exists(PLUGIN_JS_PATH):
        print("Erro: manifest.json ou plugin.js não encontrados. Compile antes com 'pnpm build'.")
        sys.exit(1)

    with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    with open(PLUGIN_JS_PATH, "r", encoding="utf-8") as f:
        code = f.read()

    readme = ""
    if os.path.exists(README_PATH):
        with open(README_PATH, "r", encoding="utf-8") as f:
            readme = f.read()

    # Cria o JSON do artefato
    artifact_payload = {
        "manifest": manifest,
        "code": code,
        "readme": readme
    }
    artifact_str = json.dumps(artifact_payload, ensure_ascii=False)
    artifact_sha = hashlib.sha256(artifact_str.encode("utf-8")).hexdigest()
    readme_sha = hashlib.sha256(readme.encode("utf-8")).hexdigest()

    os.makedirs(ARTIFACTS_DIR, exist_ok=True)
    artifact_file = os.path.join(ARTIFACTS_DIR, f"{artifact_sha}.json")
    with open(artifact_file, "w", encoding="utf-8") as f:
        f.write(artifact_str)
    print(f"✓ Artefato salvo em: {artifact_file}")

    # Atualiza registry.json
    if not os.path.exists(REGISTRY_PATH):
        print(f"Erro: registry.json não encontrado em {REGISTRY_PATH}")
        sys.exit(1)

    with open(REGISTRY_PATH, "r", encoding="utf-8") as f:
        registry = json.load(f)

    installed = registry.setdefault("installed", {})
    existing = installed.get("digital.cortexx.orgfy", {})

    prev_sha = existing.get("current")

    # Obter URL do repositório remoto git (GitHub) em vez do caminho local
    repo_url = "https://github.com/HeltonFraga01/orgfy-buzz-plugin"
    try:
        import subprocess
        remote_out = subprocess.check_output(
            ["git", "-C", PLUGIN_DIR, "remote", "get-url", "origin"],
            text=True, stderr=subprocess.DEVNULL
        ).strip()
        if remote_out:
            if remote_out.endswith(".git"):
                remote_out = remote_out[:-4]
            if remote_out.startswith("git@github.com:"):
                remote_out = "https://github.com/" + remote_out[len("git@github.com:"):]
            repo_url = remote_out
    except Exception:
        pass

    installed["digital.cortexx.orgfy"] = {
        "manifest": manifest,
        "current": artifact_sha,
        "currentSignature": None,
        "currentSource": {
            "repository": repo_url,
            "reference": "",
            "path": "."
        },
        "previous": prev_sha,
        "previousSignature": None,
        "previousSource": {
            "repository": repo_url,
            "reference": "",
            "path": "."
        } if prev_sha else None,
        "enabled": True,
        "readmeRevision": readme_sha
    }

    with open(REGISTRY_PATH, "w", encoding="utf-8") as f:
        json.dump(registry, f, indent=2, ensure_ascii=False)
    print(f"✓ Registry atualizado com sucesso em: {REGISTRY_PATH}")
    print(f"🎉 Plugin 'digital.cortexx.orgfy' ativado no Buzz Desktop com SHA: {artifact_sha[:16]}...")

if __name__ == "__main__":
    main()
