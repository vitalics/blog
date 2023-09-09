import { POSTS_PER_PAGE } from "../data/common";

const getPageNumbers = (numberOfPosts: number) => {
  const numberOfPages = numberOfPosts / POSTS_PER_PAGE;

  let pageNumbers: number[] = [];
  for (let i = 1; i <= Math.ceil(numberOfPages); i++) {
    pageNumbers = [...pageNumbers, i];
  }

  return pageNumbers;
};

export default getPageNumbers;
