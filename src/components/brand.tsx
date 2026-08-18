import Link from "next/link";

export type BrandInfo = {
  brandName: string;
  monogram: string;
  logoUrl: string | null;
};

const SIZES = {
  sm: { box: "h-7 w-7", text: "text-xs", label: "text-sm" },
  md: { box: "h-8 w-8", text: "text-sm", label: "text-base" },
} as const;

/**
 * The logo lockup, used in every header so a branding change lands everywhere
 * at once. Falls back to the monogram when no logo image is configured.
 */
export function Brand({
  brand,
  href = "/",
  size = "md",
  showName = true,
  className = "",
}: {
  brand: BrandInfo;
  href?: string;
  size?: keyof typeof SIZES;
  showName?: boolean;
  className?: string;
}) {
  const s = SIZES[size];

  const mark = brand.logoUrl ? (
    // Branding images are arbitrary user uploads (often data URIs), so this
    // deliberately skips next/image optimisation.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={brand.logoUrl}
      alt=""
      className={`${s.box} shrink-0 rounded-lg object-contain`}
    />
  ) : (
    <span
      className={`grid ${s.box} shrink-0 place-items-center rounded-lg bg-volt-500 ${s.text} font-black text-[var(--color-accent-fg)]`}
      aria-hidden="true"
    >
      {brand.monogram}
    </span>
  );

  const content = (
    <>
      {mark}
      {showName ? <span className="truncate">{brand.brandName}</span> : null}
    </>
  );

  const classes = `flex items-center gap-2 font-bold tracking-tight ${className}`;

  return href ? (
    <Link href={href} className={classes}>
      {content}
    </Link>
  ) : (
    <span className={classes}>{content}</span>
  );
}

/**
 * Injects the derived accent palette as CSS variables on :root.
 *
 * Rendered in the root layout so every page — including ones that never read
 * settings themselves — picks up the brand colour.
 */
export function BrandTheme({
  palette,
}: {
  palette: { base: string; light: string; dark: string; foreground: string };
}) {
  const css = `:root{--color-volt-500:${palette.base};--color-volt-400:${palette.light};--color-volt-600:${palette.dark};--color-accent-fg:${palette.foreground};}`;
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
