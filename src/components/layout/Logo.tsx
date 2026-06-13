import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  href?: string;
  priority?: boolean;
}

export function Logo({ className, href, priority = false }: LogoProps) {
  const image = (
    <Image
      src="/logo.png"
      alt="Pinnacle Restaurant Manager"
      width={220}
      height={44}
      priority={priority}
      className={cn(
        "h-11 w-auto max-w-full rounded-md object-contain object-left",
        className
      )}
    />
  );

  if (href !== undefined) {
    return (
      <Link href={href} className="inline-flex shrink-0">
        {image}
      </Link>
    );
  }

  return image;
}
