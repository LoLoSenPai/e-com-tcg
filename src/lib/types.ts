export type Product = {
  _id?: string;
  name: string;
  slug: string;
  category: string;
  franchise?: "Pokemon" | "One Piece" | "Both";
  price: number;
  description: string;
  image?: string;
  badge?: string;
  tags?: string[];
  featured?: boolean;
  stock?: number;
};

export type CartItem = {
  slug: string;
  quantity: number;
};
