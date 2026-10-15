require('dotenv').config();
const dns = require('dns');
if (dns.getServers().some(server => server.startsWith('127.'))) {
  dns.setServers(['1.1.1.1', '8.8.8.8']);
}
const mongoose = require('mongoose');
const Product = require('./models/product.model');

const products = [
  {
    name: "OnePlus 13",
    description: "Hasselblad Camera for Mobile, Snapdragon 8 Elite , 120Hz Fluid Display.",
    price: 69999,
    category: "Electronics",
    image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSGCdTg4PliAYTOSXMbgInrFUUxA1_-zQ4szANgOHM1aA&s",
    stock: 75
  },
  {
    name: "Sony WH-1000XM5",
    description: "Wireless Noise Cancelling Headphones, 30 hours battery.",
    price: 29990,
    category: "Electronics",
    image: "https://m.media-amazon.com/images/I/51aXvjzcukL._SX522_.jpg",
    stock: 120
  },
  {
    name: "Nike Air Force 1 '07",
    description: "The radiance lives on in the Nike Air Force 1 '07, the b-ball icon that puts a fresh spin on what you know best.",
    price: 7495,
    category: "Fashion",
    image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRG61kJgPBdcSUWTALg7fYMv7FXxX9Z5A0hJzxpUjvFAg&s=10",
    stock: 80
  },
  {
    name: "The Subtle Art of Not Giving a F*ck",
    description: "A Counterintuitive Approach to Living a Good Life by Mark Manson.",
    price: 399,
    category: "Books",
    image: "https://i.redd.it/h7m5q6da5fze1.jpg",
    stock: 200
  },
  {
    name: "Philips Hue Go",
    description: "Portable smart light table lamp, Bluetooth & Zigbee compatible.",
    price: 7999,
    category: "Home",
    image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT4o84fSo9Sp6V4FdHdO5Rv8hQqO8lo8ekG7T4qrmEb2w&s=10",
    stock: 25
  },
  {
    name: "Adidas Ultraboost Light",
    description: "Experience epic energy with the new Ultraboost Light, our lightest Ultraboost ever.",
    price: 18999,
    category: "Fashion",
    image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRDsD16x8HTJMb0qctlheebx1cNyeAudI0Qk8UqRwdPlw&s=10",
    stock: 60
  }
];

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('MongoDB connected for seeding...');
    await Product.deleteMany({});
    await Product.insertMany(products);
    console.log('Products seeded successfully!');
    mongoose.connection.close();
  })
  .catch(err => {
    console.error('Error seeding products:', err);
    process.exit(1);
  });
