// =============================================================================
// Edge Function: admin-users
// CRUD de usuários do painel (Supabase Authentication).
//
// Por que uma Edge Function?
//   As operações auth.admin.* exigem a SERVICE_ROLE key, que ignora RLS e dá
//   acesso total ao projeto. Ela NUNCA pode ir para o navegador. Esta função roda
//   no servidor do Supabase, onde a chave já existe como variável de ambiente.
//
// Segurança:
//   - Só aceita chamadas de usuários logados (JWT validado com auth.getUser()).
//   - Valida todos os dados no servidor (não confia no front-end).
//   - Impede o usuário de excluir/desativar a própria conta (evita ficar sem acesso).
//   - Papel fica em app_metadata (só o servidor altera); nome em user_metadata.
//
// Deploy pelo dashboard: Edge Functions → Deploy a new function → Via Editor,
// nome "admin-users", colar este arquivo, manter "Verify JWT" ligado.
// =============================================================================

import { type AdminUserAttributes, createClient, type User } from "npm:@supabase/supabase-js@2.118.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const PAPEIS = ["administrador", "usuario"] as const;
const STATUS = ["ativo", "inativo"] as const;
const BAN_INATIVO = "876000h"; // ~100 anos = desativado até reativar
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;
const MAX_PER_PAGE = 50;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Cliente com privilégios de administrador (somente no servidor).
const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ---------------------------------------------------------------------------
// Autenticação de quem chama
// ---------------------------------------------------------------------------
async function requireCaller(req: Request): Promise<User> {
  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    throw new HttpError(401, "Não autenticado.");
  }

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) throw new HttpError(401, "Sessão inválida ou expirada.");

  return data.user;
}

// ---------------------------------------------------------------------------
// Validação
// ---------------------------------------------------------------------------
type UsuarioInput = {
  nome?: unknown;
  email?: unknown;
  senha?: unknown;
  papel?: unknown;
  status?: unknown;
};

function validateUsuario(input: UsuarioInput, { senhaObrigatoria }: { senhaObrigatoria: boolean }) {
  const nome = typeof input.nome === "string" ? input.nome.trim() : "";
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const senha = typeof input.senha === "string" ? input.senha : "";
  const papel = input.papel;
  const status = input.status;

  if (nome.length < 2 || nome.length > 100) throw new HttpError(400, "Nome deve ter entre 2 e 100 caracteres.");
  if (!EMAIL_PATTERN.test(email)) throw new HttpError(400, "E-mail inválido.");
  if (senhaObrigatoria && !senha) throw new HttpError(400, "Senha é obrigatória.");
  if (senha && senha.length < MIN_PASSWORD) throw new HttpError(400, `Senha deve ter ao menos ${MIN_PASSWORD} caracteres.`);
  if (!PAPEIS.includes(papel as typeof PAPEIS[number])) throw new HttpError(400, "Papel inválido.");
  if (!STATUS.includes(status as typeof STATUS[number])) throw new HttpError(400, "Status inválido.");

  return { nome, email, senha, papel: papel as string, status: status as string };
}

function requireId(id: unknown): string {
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(400, "Id inválido.");
  return id;
}

// ---------------------------------------------------------------------------
// Mapeamento: expõe só o necessário para a tela
// ---------------------------------------------------------------------------
function toUsuario(user: User) {
  const bannedUntil = (user as User & { banned_until?: string }).banned_until;
  const inativo = bannedUntil ? new Date(bannedUntil) > new Date() : false;

  return {
    id: user.id,
    nome: (user.user_metadata?.nome as string) ?? "",
    email: user.email ?? "",
    papel: (user.app_metadata?.papel as string) ?? "usuario",
    status: inativo ? "inativo" : "ativo",
    created_at: user.created_at,
    last_sign_in_at: user.last_sign_in_at ?? null,
  };
}

function translateAuthError(error: { message?: string; status?: number; code?: string }): never {
  if (error.code === "email_exists" || /already been registered|already exists/i.test(error.message ?? "")) {
    throw new HttpError(409, "Já existe um usuário com este e-mail.");
  }
  if (error.code === "weak_password") throw new HttpError(400, "Senha fraca. Use uma senha mais forte.");
  if (error.status === 404 || error.code === "user_not_found") throw new HttpError(404, "Usuário não encontrado.");
  console.error("[admin-users] erro do Auth:", error);
  throw new HttpError(500, "Erro ao processar a solicitação.");
}

// ---------------------------------------------------------------------------
// Ações
// ---------------------------------------------------------------------------
async function listUsuarios(params: { page?: unknown; perPage?: unknown }) {
  const page = Math.max(1, Number.parseInt(String(params.page ?? 1), 10) || 1);
  const perPage = Math.min(MAX_PER_PAGE, Math.max(1, Number.parseInt(String(params.perPage ?? 10), 10) || 10));

  const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
  if (error) translateAuthError(error);

  const total = (data as { total?: number }).total ?? data.users.length;
  return { items: data.users.map(toUsuario), total, page, perPage };
}

async function createUsuario(params: UsuarioInput) {
  const usuario = validateUsuario(params, { senhaObrigatoria: true });

  const { data, error } = await adminClient.auth.admin.createUser({
    email: usuario.email,
    password: usuario.senha,
    email_confirm: true, // criado pelo admin: não exige confirmação por e-mail
    user_metadata: { nome: usuario.nome },
    app_metadata: { papel: usuario.papel },
    ban_duration: usuario.status === "inativo" ? BAN_INATIVO : "none",
  });
  if (error) translateAuthError(error);

  return toUsuario(data.user);
}

async function updateUsuario(params: UsuarioInput & { id?: unknown }, caller: User) {
  const id = requireId(params.id);
  const usuario = validateUsuario(params, { senhaObrigatoria: false });

  if (id === caller.id && usuario.status === "inativo") {
    throw new HttpError(400, "Você não pode desativar a sua própria conta.");
  }

  const attributes: AdminUserAttributes = {
    email: usuario.email,
    email_confirm: true,
    user_metadata: { nome: usuario.nome },
    app_metadata: { papel: usuario.papel },
    ban_duration: usuario.status === "inativo" ? BAN_INATIVO : "none",
  };
  if (usuario.senha) attributes.password = usuario.senha; // só troca se informada

  const { data, error } = await adminClient.auth.admin.updateUserById(id, attributes);
  if (error) translateAuthError(error);

  return toUsuario(data.user);
}

async function deleteUsuario(params: { id?: unknown }, caller: User) {
  const id = requireId(params.id);
  if (id === caller.id) throw new HttpError(400, "Você não pode excluir a sua própria conta.");

  const { error } = await adminClient.auth.admin.deleteUser(id);
  if (error) translateAuthError(error);

  return { id };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  try {
    const caller = await requireCaller(req);

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      throw new HttpError(400, "JSON inválido.");
    }

    const { action, ...params } = body;

    switch (action) {
      case "list":
        return json(await listUsuarios(params));
      case "create":
        return json(await createUsuario(params), 201);
      case "update":
        return json(await updateUsuario(params, caller));
      case "delete":
        return json(await deleteUsuario(params, caller));
      default:
        throw new HttpError(400, "Ação inválida.");
    }
  } catch (error) {
    if (error instanceof HttpError) return json({ error: error.message }, error.status);
    console.error("[admin-users] erro inesperado:", error);
    return json({ error: "Erro interno." }, 500);
  }
});
