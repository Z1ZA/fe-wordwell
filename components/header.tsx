import { Heart } from "lucide-react";
import React from "react";
import { buttonVariants } from "./ui/button";
import Link from "next/link";

const header = () => {
  return (
    <div className="sticky inset-x-0 top-0 z-30 w-full transition-all border-b border-gray-200 bg-black backdrop-blur-lg dark:bg-white">
      <div className="max-w-7xl mx-auto lg:px-8 px-6">
        <div className="relative flex h-14 items-center justify-between">
          <Link
            href="/"
            className="relative sm:absolute inset-y-0 left-0 flex items-center font-semibold dark:text-black text-white"
          >
            <img src="/swear-emoji.png" className="h-6 w-6 mr-1.5" />
            Wordwell
          </Link>

          {/* placeholder */}
          <div className="hidden sm:block invisible">Wordwell</div>

          <Link
            href="https://github.com/Z1ZA/fe-wordwell"
            target="_blank"
            referrerPolicy="no-referrer"
            className={buttonVariants({ variant: "secondary" })}
          >
            Star on GitHub <Heart className="h-4 w-4 ml-1.5 fill-primary" />
          </Link>
        </div>
      </div>
    </div>
  );
};

export default header;
