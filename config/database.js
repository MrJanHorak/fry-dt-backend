import mongoose from 'mongoose';

mongoose.set('strictQuery', false);
mongoose.connect(process.env.MONGO_DB);

const db = mongoose.connection;

db.on('connected', function () {
  console.log(`Connected to MongoDB ${db.name} at ${db.host}:${db.port}`);
});
