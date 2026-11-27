// ─────────────────────────────────────────────────────────────────────────────
// HOST COMMANDS SHA-256 INTEGRITY PINNING (Onda 3 · v17.7)
// Pinagem criptográfica dos scripts Python declarados em manifest.json -> host.commands.
// Usa Web Crypto (SubtleCrypto) no Buzz Desktop com fallback Node crypto em testes.
// ─────────────────────────────────────────────────────────────────────────────

export interface PinnedHostCommandSpec {
  id: string;
  scriptPath: string;
  sha256: string;
}

export interface CommandIntegrityCheckResult {
  id: string;
  scriptPath: string;
  expectedSha256: string;
  actualSha256?: string;
  status: "verified" | "mismatch" | "unreadable";
  detail?: string;
}

export interface CommandIntegrityAuditSummary {
  checkedAt: string;
  total: number;
  verified: number;
  mismatches: number;
  unreadable: number;
  results: CommandIntegrityCheckResult[];
}

export const PINNED_HOST_COMMANDS: readonly PinnedHostCommandSpec[] = Object.freeze([
  {
    id: "orgfy-status",
    scriptPath: "ferramentas/esteira/quadro.py",
    sha256: "eafa9756c2111605fe152083de774ca678a696a70cc037e00c476409c8f54b8d",
  },
  {
    id: "fabrica-status",
    scriptPath: "ferramentas/esteira/fabrica_status.py",
    sha256: "9cd75762a90c1fe8e234f5f8aa1eee575a90a127d537d0cb3cbd6ea46d628a95",
  },
  {
    id: "orgfy-kpis",
    scriptPath: "ferramentas/esteira/gerar_kpis_esteira.py",
    sha256: "ec21ca0b2835869c9baf5d18f27ddd1bb868be47a86aa6d9fb0884cee5ae534a",
  },
  {
    id: "orgfy-controle-write",
    scriptPath: "ferramentas/esteira/controle_fabrica_write.py",
    sha256: "de6c534db82c4d7339a6706eceff2b11ebe791fc5dfb325e48093c5e4bd5be0e",
  },
  {
    id: "orgfy-holdout",
    scriptPath: "ferramentas/esteira/holdout_runner.py",
    sha256: "730070cb98c5ed6d148f78e806e1a1856841cdca9f9347d73ff50b1954d852a2",
  },
  {
    id: "orgfy-trust-engine",
    scriptPath: "ferramentas/esteira/trust_engine.py",
    sha256: "682ae81a842589336e91c12ff4f6dc23333ea47677fd363e17ab7662b6c9cb3e",
  },
  {
    id: "orgfy-holding-scaffold",
    scriptPath: "ferramentas/esteira/holding_scaffold.py",
    sha256: "d3ccfc264be3a9e0457f79d7b61d8aba2971ee9d60d76a3b397c8d3b83a0ab7c",
  },
]);

export async function computeUtf8Sha256(content: string): Promise<string> {
  const bytes = new TextEncoder().encode(content);
  if (typeof globalThis.crypto?.subtle?.digest === "function") {
    const hashBuf = await globalThis.crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(hashBuf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  throw new Error("Web Crypto subtle.digest indisponível");
}

export async function verifyHostCommandIntegrity(
  ctx: any,
  commandId: string,
  repoRoot = "/Users/heltonfraga/.buzz/REPOS/orgfy"
): Promise<CommandIntegrityCheckResult> {
  const spec = PINNED_HOST_COMMANDS.find((c) => c.id === commandId);
  if (!spec) {
    return {
      id: commandId,
      scriptPath: "",
      expectedSha256: "",
      status: "unreadable",
      detail: "Comando não listado na tabela de pinagem SHA-256.",
    };
  }
  const readFile = ctx?.host?.readFile;
  if (typeof readFile !== "function") {
    return {
      id: spec.id,
      scriptPath: spec.scriptPath,
      expectedSha256: spec.sha256,
      status: "unreadable",
      detail: "ctx.host.readFile indisponível neste host.",
    };
  }
  try {
    const fullPath = `${repoRoot.replace(/\/$/, "")}/${spec.scriptPath}`;
    const raw = await readFile(fullPath);
    const text =
      typeof raw === "string"
        ? raw
        : raw instanceof Uint8Array
        ? new TextDecoder().decode(raw)
        : typeof raw?.text === "string"
        ? raw.text
        : typeof raw?.content === "string"
        ? raw.content
        : null;
    if (text === null) {
      return {
        id: spec.id,
        scriptPath: spec.scriptPath,
        expectedSha256: spec.sha256,
        status: "unreadable",
        detail: "Leitura retornou conteúdo vazio.",
      };
    }
    const actual = await computeUtf8Sha256(text);
    const ok = actual.toLowerCase() === spec.sha256.toLowerCase();
    return {
      id: spec.id,
      scriptPath: spec.scriptPath,
      expectedSha256: spec.sha256,
      actualSha256: actual,
      status: ok ? "verified" : "mismatch",
      detail: ok ? "SHA-256 íntegro" : `Drift detectado (${actual.slice(0, 12)} ≠ ${spec.sha256.slice(0, 12)})`,
    };
  } catch (err: any) {
    return {
      id: spec.id,
      scriptPath: spec.scriptPath,
      expectedSha256: spec.sha256,
      status: "unreadable",
      detail: err?.message ? String(err.message) : "Erro ao ler script",
    };
  }
}

export async function auditAllHostCommandsIntegrity(
  ctx: any,
  repoRoot = "/Users/heltonfraga/.buzz/REPOS/orgfy"
): Promise<CommandIntegrityAuditSummary> {
  const results = await Promise.all(
    PINNED_HOST_COMMANDS.map((spec) => verifyHostCommandIntegrity(ctx, spec.id, repoRoot))
  );
  return {
    checkedAt: new Date().toISOString(),
    total: results.length,
    verified: results.filter((r) => r.status === "verified").length,
    mismatches: results.filter((r) => r.status === "mismatch").length,
    unreadable: results.filter((r) => r.status === "unreadable").length,
    results,
  };
}
