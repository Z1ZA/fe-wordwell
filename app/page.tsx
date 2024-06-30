import ArtiKata from "@/components/answer/ArtiKata";
import DaftarKata from "@/components/answer/DaftarKata";
import HalusKata from "@/components/answer/HalusKata";

export default function Home() {
  return (
    <div className="my-12 lg:max-h-dvh mx-2">
      <div className="flex flex-col justify-center items-center gap-8 lg:flex-row flex-grow md:items-start">
        <ArtiKata />
        <HalusKata />
        <DaftarKata />
      </div>
    </div>
  );
}
