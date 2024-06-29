import axios, { AxiosInstance, AxiosResponse } from "axios";

const apiKey = process.env.NEXT_PUBLIC_REST_API_KEY;
// const apiUrl = "http://localhost:1337/api";
const apiUrl = "https://mindful-books-eeb8cba6ed.strapiapp.com/api";

const axiosClient: AxiosInstance = axios.create({
  baseURL: apiUrl,
  headers: {
    Authorization: `Bearer ${apiKey}`,
  },
});

const getAllWords = () => axiosClient.get("/words?populate=*");

export default { getAllWords };
