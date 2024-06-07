const express = require('express');
const cors = require('cors')
const jwt = require('jsonwebtoken');
require('dotenv').config();
const app = express()
app.use(express.json())
app.use(
    cors({
        origin: [
            "http://localhost:5173",
            "b9-a12-health-caduceus.web.app",
            "b9-a12-health-caduceus.firebaseapp.com",

        ],
        credentials: true,
    })
);

const port = 5000 || `${process.env.PORT}`
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.cn1yph8.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;



// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});
async function run() {
    try {
        // database
        const campCollection = client.db('mediDB').collection('camp')
        const userCollection = client.db('mediDB').collection('users')
        const participantCollection = client.db('mediDB').collection('participant')


        // jwt related api
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '10h' });
            res.send({ token });
        })

        // middlewares 
        const verifyToken = (req, res, next) => {
            // console.log('inside verify token', req.headers.authorization);
            if (!req.headers.authorization) {
                return res.status(401).send({ message: 'unauthorized access' });
            }
            const token = req.headers.authorization.split(' ')[1];
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: 'unauthorized access' })
                }
                req.decoded = decoded;
                next();
            })
        }

        // use verify Organizer after verifyToken
        const verifyOrganizer = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            const isOrganizer = user?.role === 'Organizer';
            if (!isOrganizer) {
                return res.status(403).send({ message: 'forbidden access' });
            }
            next();
        }

        // users related api
        app.get('/users', verifyToken, verifyOrganizer, async (req, res) => {
            const result = await userCollection.find().toArray();
            res.send(result);
        });
        app.get('/users/:email', async (req, res) => {
            const email = req.params.email;

            const query = { email: email };
            const result = await userCollection.findOne(query);
            res.send(result);
        });

        app.get('/users/organizer/:email', verifyToken, async (req, res) => {
            const email = req.params.email;

            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'forbidden access' })
            }

            const query = { email: email };
            const user = await userCollection.findOne(query);
            let Organizer = false;
            if (user) {
                Organizer = user?.role === 'Organizer';
            }
            res.send({ Organizer });
        })

        app.post('/users', async (req, res) => {
            const user = req.body;
            // insert email if user doesnt exists: 

            const query = { email: user.email }
            const existingUser = await userCollection.findOne(query);
            if (existingUser) {
                return res.send({ message: 'user already exists', insertedId: null })
            }
            const result = await userCollection.insertOne(user);
            res.send(result);
        });

        app.patch('/users/organizer/:id', verifyToken, verifyOrganizer, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    role: 'Organizer'
                }
            }
            const result = await userCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })

        app.delete('/users/:id', verifyToken, verifyOrganizer, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await userCollection.deleteOne(query);
            res.send(result);
        })


        // get popular collection 
        app.get('/popular', async (req, res) => {
            const result = await campCollection.find().sort({ participantCount: -1 }).limit(6).toArray()
            res.send(result)
        })


        //-------------------- camp ----------------------//


        // get all available camp collection 
        app.get('/available-camps', async (req, res) => {
            const sorted = req.query.sort;
            const order = req.query.order;
            const filter = req.query.filter;

            //search functionality
            let query = {}
            if (filter) query = { campName: { $regex: filter, $options: 'i' } }
            //sort functionality
            console.log(query);
            let sortOrder = {}
            if (sorted) sortOrder = { [sorted]: order === 'asc' ? 1 : -1 }
            const result = await campCollection.find(query).sort(sortOrder).toArray()

            res.send(result)


        }) 
        //get all camps for organizer
        app.get('/camps',  async (req, res) => {
            let page = parseFloat(req.query.currentPage || 0) 
            const filter = req.query.filter
            const sorted = req.query.sort; 
            
            let query = {}
            if (filter) query = { [sorted]: { $regex: filter, $options: 'i' } }
           
            const result = await campCollection.find(query).skip(8 * page).limit(8).toArray();
            res.send(result);
        }) 
        
        // delete camp 
        app.delete('/delete/:id', verifyToken, verifyOrganizer, async (req, res) => {
            const id = req.params.id;
            console.log(id);
            const query = { _id: new ObjectId(id)}
            const result = await campCollection.deleteOne(query);
            res.send(result);
        })
        //pagination manage camp
        app.get('/camp-count', async (req, res) => {
            const count = await campCollection.estimatedDocumentCount()
            res.send({ count });
        })
      
        // post new camp
        app.post('/add-camp', verifyToken, verifyOrganizer, async (req, res) => {
            const item = req.body;
            
            const result = await campCollection.insertOne(item);
            res.send(result);
        });
        // update camp
        app.put('/update-camp/:id', verifyToken, verifyOrganizer, async (req, res) => {
            const item = req.body;
            const id = req.params.id;
            
            const filter = { _id: new ObjectId(id) }
           
            const updatedDoc = {
                $set: {
                      healthcareProfessional:item.healthcareProfessional
                    , location:item.location
                    , dateTime:item.dateTime
                    , campFees:item.campFees
                    , image:item.image
                    , campName:item.campName
                    , description:item.description
                }
            }
  
            const result = await campCollection.updateOne(filter,updatedDoc);
            res.send(result);
        });
        // get single card details
        app.get('/details/:id', async (req, res) => {
            const id = req.params.id;
           
            const query = { _id: new ObjectId(id) }
            const result = await campCollection.findOne(query);
            res.send(result);
        })




        //-------------- participant  ----------------------//



        //get all participant for organizer
        app.get('/participants', async (req, res) => {
            let page = parseFloat(req.query.currentPage || 0)
            const filter = req.query.filter
            const sorted = req.query.sort;

            let query = {}
            if (filter) query = { [sorted]: { $regex: filter, $options: 'i' } }

            const result = await participantCollection.find(query).skip(8 * page).limit(8).toArray();
            res.send(result);
        }) 

        // pagination participant 
        app.get('/participant-count', async (req, res) => {
            const count = await participantCollection.estimatedDocumentCount()
            res.send({ count });
        })

        // update participant
        app.put('/update-participant/:id', verifyToken, verifyOrganizer, async (req, res) => {
            const item = req.body;
            const id = req.params.id;

            const filter = { _id: new ObjectId(id) }

            const updatedDoc = {
                $set: {
                    payment_status:item.payment_status ,

                    confirmation_status:item.confirmation_status
                }
            }

            const result = await participantCollection.updateOne(filter, updatedDoc);
            res.send(result);
        });
  // delete participant 
        app.delete('/delete-participant/:id', verifyToken, verifyOrganizer, async (req, res) => {
            const id = req.params.id;
            console.log(id);
            const query = { _id: new ObjectId(id)}
            const result = await participantCollection.deleteOne(query);
            res.send(result);
        })

        // Send a ping to confirm a successful connection
        await client.db("Organizer").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})