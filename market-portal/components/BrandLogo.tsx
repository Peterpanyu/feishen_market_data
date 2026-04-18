import Image from "next/image";

const LOGO_SRC = "/branding/feishen-logo.png";
const RATIO_W = 140;
const RATIO_H = 200;

/** 顶栏品牌：PNG + 副标题 */
export function BrandLogo() {
  return (
    <span className="inline-flex max-w-full items-center gap-2 sm:gap-2.5">
      <span className="relative inline-block drop-shadow-[0_0_18px_rgba(239,68,68,0.25)] transition-[filter] duration-300 group-hover:drop-shadow-[0_0_22px_rgba(248,113,113,0.45)]">
        <Image
          src={LOGO_SRC}
          alt="飞神 FEISHEN"
          width={RATIO_W}
          height={RATIO_H}
          priority
          className="h-8 w-auto max-h-8 object-contain object-left sm:h-9 sm:max-h-9"
        />
      </span>
      <span className="hidden border-l border-zinc-700/70 pl-2.5 sm:block">
        <span className="block text-[10px] font-medium leading-tight tracking-wide text-zinc-500 transition-colors duration-300 group-hover:text-zinc-400">
          市场洞察
        </span>
      </span>
    </span>
  );
}
