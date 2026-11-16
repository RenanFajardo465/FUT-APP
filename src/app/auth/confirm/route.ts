import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  // Erro devolvido pelo provedor OAuth (ex.: usuário cancelou no Google).
  if (searchParams.get("error")) {
    return NextResponse.redirect(new URL("/login?erro=google", origin));
  }
  const supabase = await createClient();

  let ok = false;
  if (tokenHash && type) {
    // Confirmação de cadastro por e-mail.
    ok = !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error;
  } else if (code) {
    // Retorno do Google (PKCE) ou link de e-mail no fluxo PKCE.
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  }
  return NextResponse.redirect(new URL(ok ? "/grupos" : "/login?erro=link", origin));
}
