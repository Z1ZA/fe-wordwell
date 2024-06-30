"use client";

import React, { useEffect, useState } from "react";
import { AxiosResponse } from "axios";
import GlobalApi from "@/app/_utils/GlobalApi";
import { Button } from "../ui/button";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../ui/accordion";

interface Description {
  type: string;
  children: { text: string }[];
}

interface Attributes {
  category: string;
  createdAt: string;
  description: Description[];
  publishedAt: string;
  source: string;
  title: string;
  updatedAt: string;
}

interface Word {
  id: string;
  attributes: Attributes;
}

const DaftarKata: React.FC = (): JSX.Element => {
  const [wordList, setWordList] = useState<Word[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [filteredWords, setFilteredWords] = useState<Word[]>([]);

  useEffect(() => {
    getWords();
  }, []);

  useEffect(() => {
    const sortedWords = [...wordList].sort((a, b) =>
      a.attributes.title.localeCompare(b.attributes.title)
    );

    if (searchTerm === "") {
      setFilteredWords(sortedWords);
    } else {
      setFilteredWords(
        sortedWords.filter((item) =>
          item.attributes.title.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }
  }, [searchTerm, wordList]);

  const getWords = (): void => {
    GlobalApi.getAllWords().then((resp: AxiosResponse<{ data: Word[] }>) => {
      console.log(resp.data.data);
      const sortedData = resp.data.data.sort((a, b) =>
        a.attributes.title.localeCompare(b.attributes.title)
      );
      setWordList(sortedData);
      setFilteredWords(sortedData);
    });
  };

  return (
    <div className="max-w-md w-full flex flex-col items-center p-6 mb-14 rounded-lg gap-2 shadow-lg border dark:border-white">
      <div>
        <h1 className="font-medium text-base">Kumpulan Kata-Kata Kasar</h1>
      </div>
      <div className="w-full flex items-center gap-2 mb-4">
        <Input
          type="text"
          placeholder="Cari kata..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full"
        />
        <Button onClick={() => setSearchTerm("")}>Reset</Button>
      </div>
      {filteredWords.map((item, index) => (
        <Accordion key={index} type="single" collapsible className="w-full">
          <AccordionItem value={`item-${index}`}>
            <AccordionTrigger>
              {typeof item?.attributes?.title === "string"
                ? item.attributes.title
                : "Invalid title"}
            </AccordionTrigger>
            <AccordionContent className="flex flex-col gap-2">
              <div>
                {item.attributes.description.map((desc, descIndex) => (
                  <div key={descIndex}>
                    {desc.children.map((child, childIndex) => (
                      <p key={childIndex}>{child.text}</p>
                    ))}
                  </div>
                ))}
              </div>
              <div className="flex">
                <p>
                  Sumber: <span>{item.attributes.source}</span>
                </p>
              </div>
              <div className="flex">
                <p>
                  Bahasa: <span>{item.attributes.category}</span>
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      ))}
    </div>
  );
};

export default DaftarKata;
