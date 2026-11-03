const Razorpay = require('razorpay');

function getRazorpayClient() {
  const key_id =
    process.env.RAZORPAY_KEY_ID &&
    !process.env.RAZORPAY_KEY_ID.includes('your_razorpay') &&
    process.env.RAZORPAY_KEY_ID !== 'rzp_test_placeholder'
      ? process.env.RAZORPAY_KEY_ID.trim()
      : 'rzp_test_placeholder';

  const key_secret =
    process.env.RAZORPAY_KEY_SECRET &&
    !process.env.RAZORPAY_KEY_SECRET.includes('your_razorpay') &&
    process.env.RAZORPAY_KEY_SECRET !== 'razorpay_secret_placeholder'
      ? process.env.RAZORPAY_KEY_SECRET.trim()
      : 'razorpay_secret_placeholder';

  return new Razorpay({
    key_id,
    key_secret
  });
}

module.exports = {
  orders: {
    create: (options) => getRazorpayClient().orders.create(options)
  },
  getRazorpayClient
};
