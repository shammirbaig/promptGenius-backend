require("dotenv").config()

const express = require("express")
const app = express()
const cors = require("cors")
const geoip=require("geoip-lite")
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
app.use(express.json())
app.use(
  cors({
    origin: "*",
  })
)
const port = process.env.PORT || 3000;

// Create a new Express app

// Use the body-parser middleware to parse incoming request bodies
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Connect to the MongoDB database
mongoose.connect('mongodb+srv://mshammirbaig:Shammir%403028@promptgenius.td8nz2a.mongodb.net/?retryWrites=true&w=majority', { useNewUrlParser: true, useUnifiedTopology: true });

// Define a schema for the activation codes
const activationCodeSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  used: { type: Boolean, default: false }
});

// Create a model for the activation codes
const ActivationCode = mongoose.model('ActivationCode', activationCodeSchema);

// Generate a random activation code
function generateActivationCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

const stripe = require("stripe")(process.env.STRIPE_PRIVATE_KEY)

const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: 'smtp.zoho.com',
    port: 465,
    secure: true,
    auth: {
      user: 'shammir@the-promptgenius.com',
      pass: 'Shammir@3028'
    }
  });
  app.get('/', (req, res) => {
  
    const forwardedFor = req.headers['x-forwarded-for'];
  
    const ipAddress = forwardedFor ? forwardedFor.split(',')[0] : req.socket.remoteAddress;
    
    const geo = geoip.lookup(ipAddress); 

    res.send(geo);
  });
  
app.get('/send-email', async(req, res) => {
    // create an email message
    const message = {
      from: 'shammir@the-promptgenius.com',
      to: 'mshammirbaig@gmail.com',
      subject: 'Test Email',
      text: 'This is a test email sent using nodemailer!'
    };
  
    // send the email
   await  transporter.sendMail(message, (err, info) => {
      if (err) {
        console.error(err);
        return res.status(500).send(`Error: ${err.message}`);
      }
  
      console.log('Email sent: ' + info.response);
      res.status(200).send('Email sent!');
    });
  });
  

// Stripe webhook to listen to payment events
app.post('/stripe-webhook', async (req, res) => {
    let event;
  
    try {
      event = req.body;
    } catch (error) {
      console.error(error);
      return res.status(400).send(`Webhook Error: ${error.message}`);
    }
  
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const customerEmail = session.customer_details.email;
      const code = generateActivationCode();
      const activationCode = new ActivationCode({ code: code });
      await activationCode.save();
      transporter.sendMail({
        from: 'shammir@the-promptgenius.com',
        to: customerEmail,
        subject: 'Payment Confirmation',
        text: `Your payment has been successfully completed.Your Activation code is ${code}`
      }, (error, info) => {
        if (error) {
          console.error(error);
          return res.status(500).send(`Error: ${error.message}`);
        }
        console.log('Email sent: ' + info.response);
        res.status(200).send('Payment succeeded.');
      });
    } else {
      console.log(`Unhandled event type: ${event.type}`);
      res.status(200).send('Unhandled event type.');
    }
  });

const storeItems = new Map([
  [1, { priceInCents: 10000, name: "Learn React Today" }],
  [2, { priceInCents: 20000, name: "Learn CSS Today" }],
])
app.post('/validate-activation-code', async (req, res) => {
  const code = req.body.code;
  const activationCode = await ActivationCode.findOne({ code: code });
  if (!activationCode) {
    res.json({ valid: false });
  } else if (activationCode.used) {
    res.json({ valid: true});
  } else {
    activationCode.used = true;
    await activationCode.save();
    res.json({ valid: true });
  }
})

app.post("/create-checkout-session", async (req, res) => {
  try {

    const forwardedFor = req.headers['x-forwarded-for'];
    
    const ipAddress = forwardedFor ? forwardedFor.split(',')[0] : req.socket.remoteAddress;
  
    const geo = geoip.lookup(ipAddress); 


    const currency_id = geo && geo.country === 'IN' ? 'inr' : 'usd';
console.log(currency_id)

const price_no= currency_id==="inr"? 80000: 1000;
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: 
       [{
          price_data: {
             currency: currency_id,
            product_data: {
              name:"Prompt Genius",
            },
            unit_amount: price_no,
          },
          quantity: 1,
        }]
      ,
      success_url: `${process.env.CLIENT_URL}/success.html`,
      cancel_url: `${process.env.CLIENT_URL}/cancel.html`,
    })
    res.json({ url: session.url })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.listen(port)