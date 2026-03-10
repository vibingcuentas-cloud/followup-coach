import Image from "next/image";

export default function BrandWordmark() {
  return (
    <Image
      src="/forge-logo.svg"
      alt="Forge"
      width={132}
      height={24}
      priority
      className="brandWordmark"
    />
  );
}
