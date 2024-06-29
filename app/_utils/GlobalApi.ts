import axios, { AxiosInstance, AxiosResponse } from "axios";

const apiKey = process.env.NEXT_PUBLIC_REST_API_KEY;
const apiUrl = "http://localhost:1337/api";

const axiosClient: AxiosInstance = axios.create({
  baseURL: apiUrl,
  headers: {
    Authorization: `Bearer ${apiKey}`,
  },
});

// const getAllWords = (): Promise<AxiosResponse<Word[]>> =>
//   axiosClient.get("/words");
const getAllWords = () => axiosClient.get("/words?populate=*");

export default { getAllWords };
