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
    sha256: "9e6dca21e5aa57dd89e771d23fa33f2b691752968f27fd61a4eb140c30fa4ccf",
  },
  {
    id: "orgfy-kpis",
    scriptPath: "ferramentas/esteira/gerar_kpis_esteira.py",
    sha256: "2d063aa497b563d4eb8a6a13c0c500e2076fb645020bc17bf370993a0849dc7a",
  },
  {
    id: "orgfy-controle-write",
    scriptPath: "ferramentas/esteira/controle_fabrica_write.py",
    sha256: "9289437b3f642f345217703aae1050ffbf1cd6eb846422de4bf5c5d6984a2c4a",
  },
  {
    id: "orgfy-holdout",
    scriptPath: "ferramentas/esteira/holdout_runner.py",
    sha256: "730070cb98c5ed6d148f78e806e1a1856841cdca9f9347d73ff50b1954d852a2",
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
    const text = typeof raw === "string" ? raw : typeof raw?.text === "string" ? raw.text : typeof raw?.content === "string" ? raw.content : null;
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
