import { config } from "../config";
import { SearchResult } from "@/components/answer/SearchResultComponent";

export async function braveSearch(
  message: string,
  numberOfPagesToScan = config.numberOfPagesToScan
): Promise<SearchResult[]> {
  try {
    const response = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(
        message
      )}&count=${numberOfPagesToScan}`,
      {
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip",
          "X-Subscription-Token": process.env.BRAVE_SEARCH_API_KEY as string,
        },
      }
    );
    if (!response.ok) {
      console.log("Issue with response from Brave Search API");
    }
    const jsonResponse = await response.json();
    if (!jsonResponse.web || !jsonResponse.web.results) {
      throw new Error("Invalid API response format");
    }
    const final = jsonResponse.web.results.map(
      (result: any): SearchResult => ({
        title: result.title,
        link: result.url,
        favicon: result.profile.img,
      })
    );
    return final;
  } catch (error) {
    console.error("Error fetching search results:", error);
    throw error;
  }
}

export async function googleSearch(
  message: string,
  numberOfPagesToScan = config.numberOfPagesToScan
): Promise<SearchResult[]> {
  try {
    const url = `https://www.googleapis.com/customsearch/v1?key=${
      process.env.GOOGLE_SEARCH_API_KEY
    }&cx=${process.env.GOOGLE_CX}&q=${encodeURIComponent(
      message
    )}&num=${numberOfPagesToScan}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const jsonResponse = await response.json();
    if (!jsonResponse.items) {
      throw new Error("Invalid API response format");
    }
    const final = jsonResponse.items.map(
      (result: any): SearchResult => ({
        title: result.title,
        link: result.link,
        favicon: result.pagemap?.cse_thumbnail?.[0]?.src || "",
      })
    );
    return final;
  } catch (error) {
    console.error("Error fetching search results:", error);
    throw error;
  }
}

export async function serperSearch(
  message: string,
  numberOfPagesToScan = config.numberOfPagesToScan
): Promise<SearchResult[]> {
  const url = "https://google.serper.dev/search";
  const data = JSON.stringify({
    q: message,
  });
  const requestOptions: RequestInit = {
    method: "POST",
    headers: {
      "X-API-KEY": process.env.SERPER_API as string,
      "Content-Type": "application/json",
    },
    body: data,
  };
  try {
    const response = await fetch(url, requestOptions);
    if (!response.ok) {
      throw new Error(
        `Network response was not ok. Status: ${response.status}`
      );
    }
    const responseData = await response.json();
    if (!responseData.organic) {
      throw new Error("Invalid API response format");
    }
    const final = responseData.organic.map(
      (result: any): SearchResult => ({
        title: result.title,
        link: result.link,
        favicon: result.favicons?.[0] || "",
      })
    );
    return final;
  } catch (error) {
    console.error("Error fetching search results:", error);
    throw error;
  }
}
