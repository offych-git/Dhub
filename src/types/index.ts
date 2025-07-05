export interface Deal {
  id: string;
  title: string;
  title_en?: string;
  title_es?: string;
  currentPrice: number;
  originalPrice?: number;
  category: {
    id: string;
    name: string;
  };
  store: {
    id: string;
    name: string;
  };
  image: string;
  postedAt: {
    relative: string;
    exact: string;
  };
  popularity: number;
  positiveVotes?: number;
  comments: number;
  postedBy: {
    id: string;
    name: string;
    avatar: string;
  };
  description: string;
  description_en?: string;
  description_es?: string;
  url: string;
  createdAt?: Date;
  status?: string;
  is_hot?: boolean;
  type?: string;
  deal_votes?: any[];
  imageUrls?: string[];
  updated_at?: string;
  expires_at?: string | null;
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