import ArtiKata from "@/components/answer/ArtiKata";
import HalusKata from "@/components/answer/HalusKata";
import WordList from "@/components/answer/WordList";

export default function Home() {
  return (
    <div className="w-full my-10 flex-grow max-h-dvh">
      <div className="flex flex-col justify-center items-center gap-8 lg:flex-row flex-grow md:items-start">
        <ArtiKata />
        <HalusKata />
        <WordList />
      </div>
    </div>
  );
}
