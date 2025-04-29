export interface Deal {
  id: string;
  title: string;
  currentPrice: number;
  originalPrice?: number;
  discount?: number;
  store: Store;
  category: Category;
  image: string;
  postedAt: {
    relative: string;
    exact: string;
  };
  popularity: number;
  positiveVotes?: number;
  comments: number;
  postedBy: User;
  description?: string;
  url?: string;
  createdAt?: Date;
  is_hot: boolean;
  hot_at?: Date;
  userComment?: {
    content: string;
    createdAt: string;
    replies?: {
      content: string;
      createdAt: string;
    }[];
  };
}

export interface Store {
  id: string;
  name: string;
  logo?: string;
}

export interface Category {
  id: string;
  name: string;
  icon?: string;
  subcategories?: Subcategory[];
}

export interface Subcategory {
  id: string;
  name: string;
}

export interface User {
  id: string;
  name: string;
  avatar?: string;
}

export interface Comment {
  id: string;
  user: User;
  content: string;
  createdAt: string;
  likes: number;
}

export interface Filter {
  categories: string[];
  stores: string[];
}