const express = require('express');
const app = express();
const { ObjectId } = require('mongodb');
const cors = require('cors');
const SSLCommerzPayment = require('sslcommerz-lts')
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

const store_id = process.env.STORE_ID;
const store_passwd = process.env.STORE_PASS
const is_live = false //true for live, false for sandbox



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

    const paymentCollection = client.db("doczoneDB").collection("paymentMethod")

    //jwt

    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })

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
        res.send({ admin: false })

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



    //delete appoinment
    // app.delete('/appointment/:id', async (req, res) => {
    //   try {
    //     const appointmentId = req.params.id;

    //     // Find and delete the appointment by its ID
    //     const result = await appoinmentCollection.deleteOne({ _id: appointmentId });

    //     if (result.deletedCount > 0) {
    //       // Appointment deleted successfully
    //       res.json({ success: true, message: 'Appointment deleted successfully.' });
    //     } else {
    //       // No appointment found with the given ID
    //       res.status(404).json({ success: false, message: 'Appointment not found.' });
    //     }
    //   } catch (error) {
    //     // Handle any errors that occur during the delete operation
    //     console.error(error);
    //     res.status(500).json({ success: false, message: 'Error deleting appointment.' });
    //   }
    // });
    // app.delete("appoinment", async (req, res) => {
    //   const id = req.params.id;
    //   const query = { _id: new ObjectId(id) };
    //   const result = await appoinmentCollection.deleteOne(query);
    //   res.send(result);
    // })


    //dedoctor page

    // app.post('/beDoctor', async (req, res) => {
    //   const info = req.body;
    //   console.log(info);
    //   const result = await beDoctorCollection.insertOne(info);
    //   res.send(result);
    // });


    //for payment
    const transition_id = new ObjectId().toString();
    app.post("/paymentMethod", async (req, res) => {

      const appoinmentInfo = req.body;

      const dataCovarage = appoinmentInfo.paymentInfo;
      console.log(dataCovarage);
      const data = {
        total_amount: dataCovarage?.price,
        currency: 'BDT',
        tran_id: 'transition_id', // use unique tran_id for each api call
        success_url: `http://localhost:5000/myAppointments/success/${transition_id}`,
        fail_url: `http://localhost:5000/fail/${transition_id}`,
        cancel_url: 'http://localhost:3030/cancel',
        ipn_url: 'http://localhost:3030/ipn',
        shipping_method: 'Courier',
        product_name: 'Computer.',
        product_category: 'Electronic',
        product_profile: 'general',
        cus_name: 'Customer Name',
        cus_email: dataCovarage?.email,
        cus_add1: 'Dhaka',
        cus_add2: 'Dhaka',
        cus_city: 'Dhaka',
        cus_state: 'Dhaka',
        cus_postcode: '1000',
        cus_country: 'Bangladesh',
        cus_phone: '01711111111',
        cus_fax: '01711111111',
        ship_name: 'Customer Name',
        ship_add1: 'Dhaka',
        ship_add2: 'Dhaka',
        ship_city: 'Dhaka',
        ship_state: 'Dhaka',
        ship_postcode: 1000,
        ship_country: 'Bangladesh',
      };
      const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live)
      sslcz.init(data).then(apiResponse => {
        // Redirect the user to payment gateway
        let GatewayPageURL = apiResponse.GatewayPageURL
        res.send({ url: GatewayPageURL })
        console.log('Redirecting to: ', GatewayPageURL)

        const confirmOrder = {
          dataCovarage,
          confirmStatus: false,
          transitionId: transition_id
        };
        const result = paymentCollection.insertOne(confirmOrder);


        // console.log('Redirecting to: ', GatewayPageURL)
      });

      app.post("/myAppointments/success/:tranId", async (req, res) => {
        const transId = req.params.tranId;
        const result = await paymentCollection.updateOne(
          { transitionId: transId },
          {
            $set: {
              confirmStatus: true
            }
          }
        )
        if (result.modifiedCount > 0) {
          res.redirect(`http://localhost:5000/myAppointments/success/${transId}`)
        }
        // console.log("655", transId);
      })

      app.post("/myAppointments/fail/:tranId", async (req, res) => {
        const transId = req.params.tranId;
        const result = await paymentCollection.deleteOne({ transitionId: transId });
        if (result.deletedCount) {
          res.redirect(`http://localhost:5000/myAppointments/fail/${transId}`)
        }


      });
    })












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