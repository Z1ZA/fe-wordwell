import { useState, useEffect } from "react";

// Mendefinisikan SearchResult interface dengan properti 'favicon', 'link', and 'title'
export interface SearchResult {
  favicon: string;
  link: string;
  title: string;
}
// Mendefinisikan SearchResultsComponentProps interface dengan searchResults property bertipe SearchResult[]
export interface SearchResultsComponentProps {
  searchResults: SearchResult[];
}
// Mendefinisikan SearchResultsComponent functional component dengan searchResults sebagai prop
const SearchResultsComponent = ({
  searchResults,
}: {
  searchResults: SearchResult[];
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [loadedFavicons, setLoadedFavicons] = useState<boolean[]>([]);

  // Initialize loadedFavicons state berdasarkan panjang searchResults
  useEffect(() => {
    setLoadedFavicons(Array(searchResults.length).fill(false));
  }, [searchResults]);

  const toggleExpansion = () => setIsExpanded(!isExpanded);

  // visibleResults variabel untuk menampung search results yang akan ditampilkan berdasarkan isExpanded state
  const visibleResults = isExpanded ? searchResults : searchResults.slice(0, 3);

  const handleFaviconLoad = (index: number) => {
    setLoadedFavicons((prevLoadedFavicons) => {
      const updatedLoadedFavicons = [...prevLoadedFavicons];
      updatedLoadedFavicons[index] = true;
      return updatedLoadedFavicons;
    });
  };

  // SearchResultsSkeleton untuk menampilkan loading skeleton
  const SearchResultsSkeleton = () => (
    <>
      {Array.from({ length: isExpanded ? searchResults.length : 3 }).map(
        (_, index) => (
          <div
            key={`skeleton-${index}`}
            className="p-2 w-full sm:w-1/2 md:w-1/4"
          >
            <div className="flex items-center space-x-2 dark:bg-slate-700 bg-gray-100 p-3 rounded-lg h-full">
              {searchResults[index]?.favicon.length > 0 && (
                <div className="w-5 h-5 dark:bg-slate-600 bg-gray-400 rounded animate-pulse"></div>
              )}
              <div className="w-full h-4 dark:bg-slate-600 bg-gray-400 rounded animate-pulse"></div>
            </div>
          </div>
        )
      )}
      {/* menambah skeleton untuk "View more" button */}
      <div className="w-full sm:w-full md:w-1/4 p-2">
        <div className="flex items-center space-x-2 dark:bg-slate-700 bg-gray-100 p-3 rounded-lg h-12 justify-center">
          <div className="w-5 h-5 dark:bg-slate-600 bg-gray-400 rounded animate-pulse"></div>
          <div className="w-5 h-5 dark:bg-slate-600 bg-gray-400 rounded animate-pulse"></div>
          <div className="w-5 h-5 dark:bg-slate-600 bg-gray-400 rounded animate-pulse"></div>
          <div className="w-full h-4 dark:bg-slate-600 bg-gray-400 rounded animate-pulse"></div>
        </div>
      </div>
    </>
  );

  // Render SearchResultsComponent
  return (
    <div className="dark:bg-slate-800 bg-white shadow-lg rounded-lg p-4 mt-4 max-w-sm md:max-w-md">
      <div className="flex items-center">
        <h2 className="text-lg font-semibold flex-grow dark:text-white text-black">
          Sources
        </h2>
      </div>
      <div className="flex flex-wrap my-2">
        {searchResults.length === 0 ? (
          // Render SearchResultsSkeleton jika tidak ada hasil pencarian
          <SearchResultsSkeleton />
        ) : (
          <>
            {/* Render search results dengan favicon, title, and link */}
            {visibleResults.map((result, index) => (
              <div
                key={`searchResult-${index}`}
                className="p-2 w-full md:w-1/4"
              >
                <div className="flex items-center space-x-2 dark:bg-slate-700 bg-gray-100 p-3 rounded-lg h-full">
                  {result.favicon.length > 0 && !loadedFavicons[index] && (
                    <div className="w-5 h-5 dark:bg-slate-600 bg-gray-400 rounded animate-pulse"></div>
                  )}
                  {result.favicon.length > 0 && (
                    <img
                      src={result.favicon}
                      alt="favicon"
                      className={`w-5 h-5 ${
                        loadedFavicons[index] ? "block" : "hidden"
                      }`}
                      onLoad={() => handleFaviconLoad(index)}
                    />
                  )}
                  <a
                    href={result.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-semibold truncate dark:text-gray-200 dark:hover:text-white text-gray-700 hover:text-black"
                  >
                    {result.title}
                  </a>
                </div>
              </div>
            ))}
            {/* Render tombol untuk toggle expansion hasil pencarian */}
            <div className="w-full sm:w-full md:w-1/4 p-2">
              <div
                onClick={toggleExpansion}
                className="flex items-center space-x-2 dark:bg-slate-700 bg-gray-100 p-3 rounded-lg cursor-pointer h-12 justify-center"
              >
                {!isExpanded ? (
                  <>
                    {searchResults
                      .slice(0, 3)
                      .map((result, index) =>
                        result.favicon.length ? (
                          <img
                            key={`favicon-${index}`}
                            src={result.favicon}
                            alt="favicon"
                            className="w-4 h-4"
                          />
                        ) : null
                      )}
                    <span className="text-sm font-semibold dark:text-gray-200 text-gray-700">
                      View more
                    </span>
                  </>
                ) : (
                  <span className="text-sm font-semibold dark:text-gray-200 text-gray-700">
                    Show Less
                  </span>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SearchResultsComponent;
