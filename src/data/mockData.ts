import { Laptop, Home, Tv, Gift, CarFront, Baby, Shirt, Smartphone, Speaker, Camera, Gamepad, Cpu, Mouse, Home as SmartHome, Book, HardDrive, Wrench, Wind, UtensilsCrossed, Shirt as ClothingIcon, SprayCan as Spray, Music2, Bike, Shield, Sofa, Lightbulb, ShowerHead as Shower, PenTool as Tools, Scissors, FlowerIcon, Package, PaintBucket, Frame, Heart, Sparkles, Droplet, Pill, Glasses, Apple, Milk, Fish, Carrot, Wine, Cookie, Leaf, Dumbbell, Tent, Bike as BikeIcon, Snowflake, Ship, Cog as Yoga, Film, Music, BookOpen, Ticket, Palette, GiftIcon, Flower2, Wallet, BadgePercent, TrendingUp, CreditCard, Receipt, Coins, Bitcoin, Building2, Truck, Hammer, GraduationCap, Stethoscope, Scale, Code, Scissors as BeautyIcon, MoveDiagonal, Trash2, Briefcase, Building, Cat, Crown, Clock, HeartHandshake, Package as Tobacco } from 'lucide-react';

export const stores: Store[] = [
  { id: '1', name: 'Amazon' },
  { id: '2', name: 'Best Buy' },
  { id: '3', name: 'Walmart' },
  { id: '4', name: 'Target' },
  { id: '5', name: 'Newegg' },
  { id: '6', name: 'eBay' },
  { id: '7', name: 'Costco' },
];

export const categories: Category[] = [
  {
    id: 'electronics',
    name: 'Электроника',
    subcategories: [
      { id: 'electronics-general', name: 'Электроника' },
      { id: 'smartphones', name: 'Смартфоны и гаджеты' },
      { id: 'laptops', name: 'Ноутбуки и компьютеры' },
      { id: 'tv', name: 'Телевизоры и видео' },
      { id: 'audio', name: 'Аудиотехника' },
      { id: 'photo', name: 'Фототехника' },
      { id: 'gaming', name: 'Игровые консоли и игры' },
      { id: 'pc-components', name: 'Комплектующие для ПК' },
      { id: 'peripherals', name: 'Периферия' },
      { id: 'smart-home', name: 'Умный дом' },
      { id: 'ebooks', name: 'Электронные книги' },
      { id: 'storage', name: 'Носители информации' }
    ]
  },
  {
    id: 'appliances',
    name: 'Бытовая техника',
    subcategories: [
      { id: 'appliances-general', name: 'Бытовая техника' },
      { id: 'major-appliances', name: 'Крупная бытовая техника' },
      { id: 'small-appliances', name: 'Мелкая бытовая техника' },
      { id: 'climate', name: 'Климатическая техника' },
      { id: 'kitchen', name: 'Техника для кухни' },
      { id: 'laundry', name: 'Уход за одеждой' },
      { id: 'cleaning', name: 'Уборка' }
    ]
  },
  {
    id: 'auto',
    name: 'Автомобили',
    subcategories: [
      { id: 'auto-general', name: 'Автомобили' },
      { id: 'vehicles', name: 'Транспортные средства' },
      { id: 'tires', name: 'Шины и диски' },
      { id: 'auto-accessories', name: 'Автоаксессуары' },
      { id: 'auto-chemistry', name: 'Автохимия и масла' },
      { id: 'auto-sound', name: 'Автозвук' },
      { id: 'auto-service', name: 'Обслуживание авто' },
      { id: 'moto', name: 'Мототехника' },
      { id: 'bicycle', name: 'Велосипеды' },
      { id: 'auto-insurance', name: 'Автострахование' }
    ]
  },
  {
    id: 'home-garden',
    name: 'Дом и сад',
    subcategories: [
      { id: 'home-general', name: 'Дом и сад' },
      { id: 'furniture', name: 'Мебель' },
      { id: 'textiles', name: 'Текстиль' },
      { id: 'lighting', name: 'Освещение' },
      { id: 'plumbing', name: 'Сантехника' },
      { id: 'tools', name: 'Инструменты' },
      { id: 'garden-tools', name: 'Садовая техника' },
      { id: 'plants', name: 'Растения' },
      { id: 'household', name: 'Хозтовары' },
      { id: 'repair', name: 'Ремонт' },
      { id: 'interior', name: 'Интерьер' }
    ]
  },
  {
    id: 'kids',
    name: 'Детские товары',
    subcategories: [
      { id: 'kids-general', name: 'Детские товары' },
      { id: 'kids-clothes', name: 'Детская одежда' },
      { id: 'kids-shoes', name: 'Детская обувь' },
      { id: 'toys', name: 'Игрушки' },
      { id: 'strollers', name: 'Коляски' },
      { id: 'kids-furniture', name: 'Детская мебель' },
      { id: 'school', name: 'Товары для школы' },
      { id: 'baby-food', name: 'Питание для детей' },
      { id: 'baby-care', name: 'Гигиена и уход' },
      { id: 'safety', name: 'Безопасность' }
    ]
  },
  {
    id: 'beauty-health',
    name: 'Красота и здоровье',
    subcategories: [
      { id: 'beauty-general', name: 'Красота и здоровье' },
      { id: 'cosmetics', name: 'Косметика' },
      { id: 'perfume', name: 'Парфюмерия' },
      { id: 'hair-care', name: 'Уход за волосами' },
      { id: 'face-care', name: 'Уход за лицом' },
      { id: 'body-care', name: 'Уход за телом' },
      { id: 'vitamins', name: 'БАДы и витамины' },
      { id: 'medical', name: 'Медицинские товары' },
      { id: 'hygiene', name: 'Гигиена' },
      { id: 'optics', name: 'Оптика' }
    ]
  },
  {
    id: 'clothing',
    name: 'Одежда и обувь',
    subcategories: [
      { id: 'clothing-general', name: 'Одежда и обувь' },
      { id: 'mens-clothes', name: 'Мужская одежда' },
      { id: 'womens-clothes', name: 'Женская одежда' },
      { id: 'kids-clothes', name: 'Детская одежда' },
      { id: 'mens-shoes', name: 'Мужская обувь' },
      { id: 'womens-shoes', name: 'Женская обувь' },
      { id: 'hats', name: 'Головные уборы' },
      { id: 'accessories', name: 'Аксессуары' },
      { id: 'sports-clothes', name: 'Спортивная одежда' },
      { id: 'underwear', name: 'Нижнее белье' }
    ]
  },
  {
    id: 'food',
    name: 'Продукты питания',
    subcategories: [
      { id: 'food-general', name: 'Продукты питания' },
      { id: 'grocery', name: 'Бакалея' },
      { id: 'dairy', name: 'Молочные продукты' },
      { id: 'meat-fish', name: 'Мясо и рыба' },
      { id: 'fruits-vegetables', name: 'Овощи и фрукты' },
      { id: 'beverages', name: 'Напитки' },
      { id: 'sweets', name: 'Сладости' },
      { id: 'healthy-food', name: 'Здоровое питание' },
      { id: 'baby-food', name: 'Детское питание' },
      { id: 'ready-meals', name: 'Полуфабрикаты' }
    ]
  },
  {
    id: 'sports',
    name: 'Спорт и отдых',
    subcategories: [
      { id: 'sports-general', name: 'Спорт и отдых' },
      { id: 'sports-nutrition', name: 'Спортивное питание' },
      { id: 'fitness', name: 'Фитнес' },
      { id: 'tourism', name: 'Туризм' },
      { id: 'cycling', name: 'Велоспорт' },
      { id: 'winter-sports', name: 'Зимние виды спорта' },
      { id: 'water-sports', name: 'Водные виды спорта' },
      { id: 'yoga', name: 'Йога' },
      { id: 'exercise-equipment', name: 'Тренажеры' },
      { id: 'sports-accessories', name: 'Спортивные аксессуары' }
    ]
  },
  {
    id: 'entertainment',
    name: 'Развлечения',
    subcategories: [
      { id: 'entertainment-general', name: 'Развлечения' },
      { id: 'movies', name: 'Кино' },
      { id: 'music', name: 'Музыка' },
      { id: 'books', name: 'Книги' },
      { id: 'games', name: 'Игры' },
      { id: 'tickets', name: 'Билеты' },
      { id: 'hobbies', name: 'Хобби' },
      { id: 'stationery', name: 'Канцтовары' },
      { id: 'gifts', name: 'Подарки' },
      { id: 'flowers', name: 'Цветы' }
    ]
  },
  {
    id: 'finance',
    name: 'Финансы',
    subcategories: [
      { id: 'finance-general', name: 'Финансы' },
      { id: 'loans', name: 'Кредиты' },
      { id: 'insurance', name: 'Страхование' },
      { id: 'investments', name: 'Инвестиции' },
      { id: 'banking', name: 'Банковские услуги' },
      { id: 'taxes', name: 'Налоги' },
      { id: 'payment-systems', name: 'Платежные системы' },
      { id: 'crypto', name: 'Криптовалюта' },
      { id: 'pawnshops', name: 'Ломбарды' }
    ]
  },
  {
    id: 'services',
    name: 'Услуги',
    subcategories: [
      { id: 'services-general', name: 'Услуги' },
      { id: 'delivery', name: 'Доставка' },
      { id: 'repair-services', name: 'Ремонт' },
      { id: 'education', name: 'Образование' },
      { id: 'medicine', name: 'Медицина' },
      { id: 'legal', name: 'Юридические услуги' },
      { id: 'it-services', name: 'IT-услуги' },
      { id: 'beauty-services', name: 'Красота' },
      { id: 'moving', name: 'Переезды' },
      { id: 'cleaning-services', name: 'Клининг' }
    ]
  },
  {
    id: 'other',
    name: 'Другое',
    subcategories: [
      { id: 'other-general', name: 'Другое' },
      { id: 'jobs', name: 'Работа' },
      { id: 'real-estate', name: 'Недвижимость' },
      { id: 'pets', name: 'Животные' },
      { id: 'collecting', name: 'Коллекционирование' },
      { id: 'antiques', name: 'Антиквариат' },
      { id: 'wine', name: 'Вино' },
      { id: 'tobacco', name: 'Табак' },
      { id: 'jewelry', name: 'Ювелирные изделия' },
      { id: 'watches', name: 'Часы' }
    ]
  }
];

export const categoryIcons: Record<string, any> = {
  'Электроника': Tv,
  'Смартфоны и гаджеты': Smartphone,
  'Ноутбуки и компьютеры': Laptop,
  'Телевизоры и видео': Tv,
  'Аудиотехника': Speaker,
  'Фототехника': Camera,
  'Игровые консоли и игры': Gamepad,
  'Комплектующие для ПК': Cpu,
  'Периферия': Mouse,
  'Умный дом': SmartHome,
  'Электронные книги': Book,
  'Носители информации': HardDrive,
  'Бытовая техника': Wrench,
  'Крупная бытовая техника': Wrench,
  'Мелкая бытовая техника': Wrench,
  'Климатическая техника': Wind,
  'Техника для кухни': UtensilsCrossed,
  'Уход за одеждой': ClothingIcon,
  'Уборка': Spray,
  'Автомобили': CarFront,
  'Транспортные средства': CarFront,
  'Шины и диски': CarFront,
  'Автоаксессуары': CarFront,
  'Автохимия и масла': Spray,
  'Автозвук': Music2,
  'Обслуживание авто': Wrench,
  'Мототехника': Bike,
  'Велосипеды': Bike,
  'Автострахование': Shield,
  'Дом и сад': Home,
  'Мебель': Sofa,
  'Текстиль': Shirt,
  'Освещение': Lightbulb,
  'Сантехника': Shower,
  'Инструменты': Tools,
  'Садовая техника': Scissors,
  'Растения': FlowerIcon,
  'Хозтовары': Package,
  'Ремонт': PaintBucket,
  'Интерьер': Frame,
  'Детские товары': Baby,
  'Детская одежда': Baby,
  'Детская обувь': Baby,
  'Игрушки': Gift,
  'Коляски': Baby,
  'Детская мебель': Baby,
  'Товары для школы': Book,
  'Питание для детей': Baby,
  'Гигиена и уход': Baby,
  'Безопасность': Shield,
  'Красота и здоровье': Heart,
  'Косметика': Sparkles,
  'Парфюмерия': Droplet,
  'Уход за волосами': Sparkles,
  'Уход за лицом': Sparkles,
  'Уход за телом': Sparkles,
  'БАДы и витамины': Pill,
  'Медицинские товары': Heart,
  'Гигиена': Droplet,
  'Оптика': Glasses,
  'Одежда и обувь': Shirt,
  'Мужская одежда': Shirt,
  'Женская одежда': Shirt,
  'Мужская обувь': Shirt,
  'Женская обувь': Shirt,
  'Головные уборы': Shirt,
  'Аксессуары': Shirt,
  'Спортивная одежда': Shirt,
  'Нижнее белье': Shirt,
  'Продукты питания': Apple,
  'Бакалея': Apple,
  'Молочные продукты': Milk,
  'Мясо и рыба': Fish,
  'Овощи и фрукты': Carrot,
  'Напитки': Wine,
  'Сладости': Cookie,
  'Здоровое питание': Leaf,
  'Полуфабрикаты': UtensilsCrossed,
  'Спорт и отдых': Dumbbell,
  'Спортивное питание': Dumbbell,
  'Фитнес': Dumbbell,
  'Туризм': Tent,
  'Велоспорт': BikeIcon,
  'Зимние виды спорта': Snowflake,
  'Водные виды спорта': Ship,
  'Йога': Yoga,
  'Тренажеры': Dumbbell,
  'Спортивные аксессуары': Dumbbell,
  'Развлечения': Film,
  'Кино': Film,
  'Музыка': Music,
  'Книги': BookOpen,
  'Игры': Gamepad,
  'Билеты': Ticket,
  'Хобби': Palette,
  'Канцтовары': BookOpen,
  'Подарки': GiftIcon,
  'Цветы': Flower2,
  'Финансы': Wallet,
  'Кредиты': BadgePercent,
  'Страхование': Shield,
  'Инвестиции': TrendingUp,
  'Банковские услуги': CreditCard,
  'Налоги': Receipt,
  'Платежные системы': Coins,
  'Криптовалюта': Bitcoin,
  'Ломбарды': Building2,
  'Услуги': Wrench,
  'Доставка': Truck,
  'Ремонт': Hammer,
  'Образование': GraduationCap,
  'Медицина': Stethoscope,
  'Юридические услуги': Scale,
  'IT-услуги': Code,
  'Красота': BeautyIcon,
  'Переезды': MoveDiagonal,
  'Клининг': Trash2,
  'Другое': Package,
  'Работа': Briefcase,
  'Недвижимость': Building,
  'Животные': Cat,
  'Коллекционирование': Crown,
  'Антиквариат': Crown,
  'Вино': Wine,
  'Табак': Tobacco,
  'Ювелирные изделия': HeartHandshake,
  'Часы': Clock
};

export const users: User[] = [
  { id: '1', name: 'DealHunter', avatar: 'https://i.pravatar.cc/150?img=1' },
  { id: '2', name: 'BestDeals', avatar: 'https://i.pravatar.cc/150?img=2' },
  { id: '3', name: 'BargainFinder', avatar: 'https://i.pravatar.cc/150?img=3' },
  { id: '4', name: 'ShopSmart', avatar: 'https://i.pravatar.cc/150?img=4' },
];

export const mockDeals: Deal[] = [
  {
    id: '1',
    title: 'Apple AirPods Pro (2nd Gen)',
    currentPrice: 189.99,
    originalPrice: 249.99,
    discount: 24,
    store: stores[0],
    category: categories[0],
    image: 'https://images.pexels.com/photos/3780681/pexels-photo-3780681.jpeg',
    postedAt: '1h',
    popularity: 156,
    comments: 12,
    postedBy: users[0],
    description: 'Apple AirPods Pro (2nd Generation) with MagSafe Case (USB-C). Active Noise Cancellation, Transparency mode, Spatial Audio with dynamic head tracking.',
    url: 'https://example.com/deal/1',
  },
  {
    id: '2',
    title: 'Samsung 65" Class QLED 4K Smart TV',
    currentPrice: 799.99,
    originalPrice: 999.99,
    discount: 20,
    store: stores[1],
    category: categories[0],
    image: 'https://images.pexels.com/photos/6976094/pexels-photo-6976094.jpeg',
    postedAt: '3h',
    popularity: 243,
    comments: 32,
    postedBy: users[1],
    description: 'Samsung 65" Class QLED 4K Smart TV with Quantum HDR, Motion Xcelerator, Object Tracking Sound Lite.',
    url: 'https://example.com/deal/2',
  },
  {
    id: '3',
    title: 'Ninja Foodi 8-in-1 Air Fryer',
    currentPrice: 149.99,
    originalPrice: 229.99,
    discount: 35,
    store: stores[2],
    category: categories[1],
    image: 'https://images.pexels.com/photos/4109850/pexels-photo-4109850.jpeg',
    postedAt: '5h',
    popularity: 187,
    comments: 18,
    postedBy: users[2],
    description: 'Ninja Foodi 8-in-1 Digital Air Fryer, Roast, Broil, Bake, Dehydrate, Keep Warm, 4-Quart Capacity, and a High Gloss Finish.',
    url: 'https://example.com/deal/3',
  },
  {
    id: '4',
    title: 'Sony WH-1000XM5 Wireless Headphones',
    currentPrice: 299.99,
    originalPrice: 399.99,
    discount: 25,
    store: stores[0],
    category: categories[0],
    image: 'https://images.pexels.com/photos/3587478/pexels-photo-3587478.jpeg',
    postedAt: '8h',
    popularity: 134,
    comments: 9,
    postedBy: users[3],
    description: 'Sony WH-1000XM5 Wireless Industry Leading Noise Canceling Headphones with Auto Noise Canceling Optimizer, Crystal Clear Hands-Free Calling.',
    url: 'https://example.com/deal/4',
  },
  {
    id: '5',
    title: 'Dyson V12 Detect Slim Cordless Vacuum',
    currentPrice: 499.99,
    originalPrice: 649.99,
    discount: 23,
    store: stores[3],
    category: categories[1],
    image: 'https://images.pexels.com/photos/4108715/pexels-photo-4108715.jpeg',
    postedAt: '12h',
    popularity: 98,
    comments: 7,
    postedBy: users[0],
    description: 'Dyson V12 Detect Slim Cordless Vacuum Cleaner. Laser illuminates invisible dust on hard floors. Precisely measures microscopic dust particles.',
    url: 'https://example.com/deal/5',
  },
  {
    id: '6',
    title: 'NVIDIA GeForce RTX 4070 Ti',
    currentPrice: 749.99,
    originalPrice: 799.99,
    discount: 6,
    store: stores[4],
    category: categories[0],
    image: 'https://m.media-amazon.com/images/I/61u5pQ152oL._AC_SX679_.jpg',
    postedAt: '13h',
    popularity: 212,
    comments: 24,
    postedBy: users[1],
    description: 'NVIDIA GeForce RTX 4070 Ti 12GB GDDR6X Graphics Card. DLSS 3 and full ray tracing. 240+ Watts of GPU power.',
    url: 'https://example.com/deal/6',
  },
];

export const mockComments: Record<string, Comment[]> = {
  '1': [
    {
      id: '1',
      user: users[2],
      content: 'Great deal! I bought these last week and they are amazing.',
      createdAt: '2h ago',
      likes: 8,
    },
    {
      id: '2',
      user: users[3],
      content: 'Do these ever go lower than this price?',
      createdAt: '1h ago',
      likes: 3,
    },
    {
      id: '3',
      user: users[0],
      content: 'I think this is the lowest they\'ve been in months.',
      createdAt: '45m ago',
      likes: 5,
    },
  ],
};

export const generatePriceHistory = (originalPrice: number, currentPrice: number): { date: string; price: number }[] => {
  const now = new Date();
  const data = [];
  
  for (let i = 30; i >= 0; i--) {
    const date = new Date();
    date.setDate(now.getDate() - i);
    
    let price;
    if (i === 0) {
      price = currentPrice;
    } else if (i >= 25) {
      price = originalPrice;
    } else {
      const diff = originalPrice - currentPrice;
      const randomFactor = Math.random();
      price = originalPrice - (diff * randomFactor * (30 - i) / 30);
      price = Math.round(price * 100) / 100;
    }
    
    data.push({
      date: date.toISOString().split('T')[0],
      price,
    });
  }
  
  return data;
};