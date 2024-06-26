const express = require('express');
const app = express();
const stripe = require("stripe")('sk_test_51P6p8cDXH7ad3HZ4OZnz6gsD0Ice7SIDoABl0v10NzGJGIcbXmYd6Jko4i7Esiig3jXtp9SUU5R4ki5zDuVfNyIB00RoZtPuSl');
const { ObjectId } = require('mongodb');
const cors = require('cors');

const jwt = require('jsonwebtoken');
require('dotenv').config();
const port = process.env.PORT || 5000;


//middlewire
app.use(cors());
app.use(express.json());

const veryfyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ error: true, message: 'unauthorized access' });
  }

  const token = authorization.split(' ')[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ error: true, message: 'unauthorized access' })
    }
    req.decoded = decoded;
    next();
  })
}







//database connection


const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.vrgzzke.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

//for sslcommerz





async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const usersCollection = client.db("doczoneDB").collection("users");
    const doctorCollection = client.db("doczoneDB").collection("doctor");
    const serviceCollection = client.db("doczoneDB").collection("service");
    const appoinmentCollection = client.db("doczoneDB").collection("appoinment");
    const beDoctorCollection = client.db("doczoneDB").collection("beDoctor");
    const addDoctorCollection = client.db("doczoneDB").collection("addDoctor");

    const paymentCollection = client.db("doczoneDB").collection("payments");



    //jwt

    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '10h' })

      res.send({ token })
    })

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const user = await usersCollection.findOne(query);
      if (user?.role !== 'admin') {
        return res.status(403).send({ error: true, message: 'forbidden message' });
      }
      next();
    }

    //user related apis

    app.get('/users', veryfyJWT, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });


    app.post('/users', async (req, res) => {
      const user = req.body;
      const query = { email: user.email }
      const existingUser = await usersCollection.findOne(query);

      if (existingUser) {
        return res.send({ message: 'user already exists' })
      }

      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    app.get('/users/admin/:email', veryfyJWT, async (req, res) => {


      const email = req.params.email;

      if (req.decoded.email !== email) {
        return res.send({ admin: false })

      }
      const query = { email: email }
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === 'admin' }
      res.send(result)
    })


    //making admin
    app.patch('/users/admin/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: 'admin'
        },
      };

      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result)
    })


    app.get('/doctor', async (req, res) => {
      const result = await doctorCollection.find().toArray();
      res.send(result)
    })

    //getting services

    app.get('/service', async (req, res) => {
      const result = await serviceCollection.find().toArray()
      res.send(result)
    })

    // app.get('/singleDoctor/:id', async (req, res) => {
    //   const id = req.params.id;
    //   const objectId = new ObjectId(id);

    //   // Find the document by its _id
    //   const result = await doctorCollection.findOne({ _id: objectId });
    //   res.send(result)
    // })

    app.get('/doctor/:id', async (req, res) => {
      const id = req.params.id;
      console.log(id);

      try {
        // Assuming doctorCollection is your MongoDB collection
        const singleDoctor = await doctorCollection.findOne({ _id: new ObjectId(id) });

        if (singleDoctor) {
          res.send(singleDoctor);
        } else {
          res.status(404).send({ error: 'Doctor not found' });
        }
      } catch (error) {
        console.error(error);
        res.status(500).send({ error: 'Internal Server Error' });
      }
    });

    //beDoctor post
    app.post('/beDoctor', async (req, res) => {
      const beDoctorInfo = req.body;
      console.log(beDoctorInfo);
      const result = await beDoctorCollection.insertOne(beDoctorInfo);
      res.send(result)
    })

    //beDoctor get


    app.get('/beDoctor', async (req, res) => {
      const cursor = beDoctorCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    })


    //adding doctor from admin dashboard

    app.post('/addDoctor', async (req, res) => {
      const addDoctorInfo = req.body;
      console.log(addDoctorInfo);
      const result = await addDoctorCollection.insertOne(addDoctorInfo)
      res.send(result)
    })




    //for delete
    app.delete("/users/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await usersCollection.deleteOne(query);
      res.send(result);
    })




    //inserting appoinment data in dashboard

    app.post('/appoinment', async (req, res) => {
      const booking = req.body;
      console.log(booking);
      const result = await appoinmentCollection.insertOne(booking);
      res.send(result)
    })

    app.get("/appoinment", veryfyJWT, async (req, res) => {
      const email = req.query.email;
      if (!email) {
        res.send([]);
      }
      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.status(403).send({ error: true, message: "no access" });
      }
      const query = { email: email };
      const result = await appoinmentCollection.find(query).toArray();
      res.send(result);
    });





    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      console.log(price, amount);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });


    app.post("/payments", async (req, res) => {
      const payment = req.body;
      const insertResult = await paymentCollection.insertOne(payment);

      const query = { _id: { $in: payment.doctorId.map(id => new ObjectId(id)) } };
      const deleteResult = await appoinmentCollection.deleteMany(query);
      res.send({ insertResult, deleteResult });

    });







    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('Doctor Appoinment is ongoing')
})

app.listen(port, () => {
  console.log(`Doctor Appoinment is ongoing on port ${port}`);
})