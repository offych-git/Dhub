import { Laptop, Home, Tv, Gift, CarFront, Baby, Shirt, Smartphone, Speaker, Camera, Gamepad, Cpu, Mouse, Home as SmartHome, Book, HardDrive, Wrench, Wind, UtensilsCrossed, Shirt as ClothingIcon, SprayCan as Spray, Music2, Bike, Shield, Sofa, Lightbulb, ShowerHead as Shower, PenTool as Tools, Scissors, FlowerIcon, Package, PaintBucket, Frame, Heart, Sparkles, Droplet, Pill, Glasses, Apple, Milk, Fish, Carrot, Wine, Cookie, Leaf, Dumbbell, Tent, Bike as BikeIcon, Snowflake, Ship, Cog as Yoga, Film, Music, BookOpen, Ticket, Palette, GiftIcon, Flower2, Wallet, BadgePercent, TrendingUp, CreditCard, Receipt, Coins, Bitcoin, Building2, Truck, Hammer, GraduationCap, Stethoscope, Scale, Code, Scissors as BeautyIcon, MoveDiagonal, Trash2, Briefcase, Building, Cat, Crown, Clock, HeartHandshake, Package as Tobacco } from 'lucide-react';

export const stores: Store[] = [
  { id: '1', name: 'Amazon' },
  { id: '2', name: 'Best Buy' },
  { id: '3', name: 'Walmart' },
  { id: '4', name: 'Target' },
  { id: '5', name: 'Newegg' },
  { id: '6', name: 'eBay' },
  { id: '7', name: 'Costco' },
  { id: 'amazon', name: 'Amazon', url: 'https://www.amazon.com' },
  { id: 'walmart', name: 'Walmart', url: 'https://www.walmart.com' },
  { id: 'target', name: 'Target', url: 'https://www.target.com' },
  { id: 'bestbuy', name: 'Best Buy', url: 'https://www.bestbuy.com' },
  { id: 'costco', name: 'Costco', url: 'https://www.costco.com' },
  { id: 'macys', name: 'Macy\'s', url: 'https://www.macys.com' },
  { id: 'ebay', name: 'eBay', url: 'https://www.ebay.com' },
  { id: 'adidas', name: 'Adidas', url: 'https://www.adidas.com' },
  { id: 'dell', name: 'Dell', url: 'https://www.dell.com' },
  { id: 'samsclub', name: 'Sam\'s Club', url: 'https://www.samsclub.com' },
  { id: 'rei', name: 'REI', url: 'https://www.rei.com' },
  { id: 'woot', name: 'Woot!', url: 'https://www.woot.com' },
  { id: 'humblebundle', name: 'Humble Bundle', url: 'https://www.humblebundle.com' },
  { id: 'academy', name: 'Academy Sports', url: 'https://www.academy.com' },
  { id: 'rakuten', name: 'Rakuten', url: 'https://www.rakuten.com' },
  { id: 'walgreens', name: 'Walgreens', url: 'https://www.walgreens.com' },
  { id: 'cvs', name: 'CVS', url: 'https://www.cvs.com' },
  { id: 'riteaid', name: 'RiteAid', url: 'https://www.riteaid.com' },
  { id: 'staples', name: 'Staples', url: 'https://www.staples.com' },
  { id: 'kohls', name: 'Kohl\'s', url: 'https://www.kohls.com' },
  { id: 'underarmour', name: 'Under Armour', url: 'https://www.underarmour.com' },
  { id: 'tommyhilfiger', name: 'Tommy Hilfiger', url: 'https://usa.tommy.com' },
  { id: 'carhartt', name: 'Carhartt', url: 'https://www.carhartt.com' },
  { id: 'apple', name: 'Apple', url: 'https://www.apple.com' },
  { id: 'google', name: 'Google', url: 'https://store.google.com' },
  { id: 'acer', name: 'Acer', url: 'https://www.acer.com' },
  { id: 'ecoflow', name: 'Ecoflow', url: 'https://www.ecoflow.com' },
  { id: 'crkd', name: 'CRKD', url: 'https://www.crkdgaming.com' },
  { id: '8bitdo', name: '8BitDo', url: 'https://www.8bitdo.com' },
  { id: 'alessiasdollhouse', name: 'Alessia\'s Dollhouse', url: 'https://www.alessiasdollhouse.com' },
  { id: 'cascadianfarm', name: 'Cascadian Farm', url: 'https://www.cascadianfarm.com' },
  { id: 'buddhaspices', name: 'Buddha Spices', url: 'https://www.buddhaspices.com' }, 

];

export const categories: Category[] = [
  {
    id: 'electronics',
    name: 'Электроника',
    subcategories: [
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
    id: 'Appliances',
    name: 'Бытовая техника',
    subcategories: [
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
      { id: 'delivery', name: 'Доставка' },
      { id: 'repair-services', name: 'Ремонт' },
      { id: 'education', name: 'Образование' },
      { id: 'medicine', name: 'Медицина' },
      { id: 'legal', name: 'Юридические услуги' },
      { id: 'it-services', name: 'IT-услуги' },
      { id: 'beauty-services', name: 'Красота' }
    ]
  },
  {
    id: 'other',
    name: 'Другое',
    subcategories: [
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


// Function to generate mock price history for visualization
export const generatePriceHistory = (originalPrice: number, currentPrice: number): { date: string; price: number }[] => {
  const today = new Date();
  const history = [];
  
  // Generate data for the last 30 days
  for (let i = 30; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    
    let price: number;
    
    if (i === 0) {
      // Today's price is the current price
      price = currentPrice;
    } else if (i === 30) {
      // Starting price is the original price
      price = originalPrice;
    } else {
      // Random variations between original and current price
      const progress = (30 - i) / 30;
      const targetPrice = originalPrice - (originalPrice - currentPrice) * progress;
      // Add some random fluctuation (±5%)
      const fluctuation = Math.random() * 0.1 - 0.05; 
      price = targetPrice * (1 + fluctuation);
      // Ensure price doesn't go below current price if it's a discount
      if (currentPrice < originalPrice && price < currentPrice) {
        price = currentPrice + Math.random() * (originalPrice - currentPrice) * 0.1;
      }
    }
    
    history.push({
      date: date.toISOString().split('T')[0],
      price: parseFloat(price.toFixed(2))
    });
  }
  
  return history;
};

// Пустой массив mockDeals вместо реальных данных
export const mockDeals: Deal[] = [];