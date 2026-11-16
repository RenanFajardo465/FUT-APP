import { ImageResponse } from "next/og";

const SIZES = new Set([180, 192, 512]);

/** Ícone do PWA gerado por código: bola estilizada sobre fundo de gramado. */
export async function GET(req: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size: raw } = await params;
  const size = SIZES.has(Number(raw)) ? Number(raw) : 192;
  const maskable = new URL(req.url).searchParams.has("maskable");
  const ball = Math.round(size * (maskable ? 0.5 : 0.66));
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0b1410",
        }}
      >
        <div
          style={{
            width: ball,
            height: ball,
            borderRadius: "50%",
            background: "#a3e635",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: ball * 0.38,
              height: ball * 0.38,
              background: "#0b1410",
              clipPath: "polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)",
            }}
          />
        </div>
      </div>
    ),
    { width: size, height: size },
  );
}
