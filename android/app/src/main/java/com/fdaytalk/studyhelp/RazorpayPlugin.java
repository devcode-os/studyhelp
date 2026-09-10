package com.fdaytalk.studyhelp;

import android.app.Activity;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.razorpay.Checkout;
import com.razorpay.PaymentData;

import org.json.JSONObject;

@CapacitorPlugin(name = "RazorpayNative")
public class RazorpayPlugin extends Plugin {

    private static final String TAG = "RazorpayPlugin";

    // Razorpay's native SDK requires the PaymentResultWithDataListener to be
    // implemented directly on the Activity passed to checkout.open() — NOT
    // on a separate object like this plugin class, even if that Activity
    // reference is correct. MainActivity implements the listener and
    // forwards results here via this static instance, since Capacitor
    // plugin instances aren't otherwise reachable from the Activity.
    private static RazorpayPlugin instance;

    private PluginCall pendingCall;

    @Override
    protected void handleOnStart() {
        super.handleOnStart();
        instance = this;
    }

    public static RazorpayPlugin getInstance() {
        return instance;
    }

    @PluginMethod
    public void open(PluginCall call) {
        Log.d(TAG, "open() called with order_id=" + call.getString("order_id") + " amount=" + call.getInt("amount"));
        this.pendingCall = call;
        bridge.saveCall(call);
        instance = this;

        try {
            Activity activity = getActivity();
            Log.d(TAG, "Activity reference: " + (activity != null ? activity.getClass().getName() : "NULL"));

            Checkout checkout = new Checkout();
            checkout.setKeyID(call.getString("key"));

            JSONObject options = new JSONObject();
            options.put("name", call.getString("name", "StudyHelp"));
            options.put("description", call.getString("description", ""));
            options.put("order_id", call.getString("order_id"));
            options.put("amount", call.getInt("amount"));
            options.put("currency", call.getString("currency", "INR"));

            JSObject prefill = call.getObject("prefill");
            if (prefill != null) {
                JSONObject prefillJson = new JSONObject();
                if (prefill.has("name")) prefillJson.put("name", prefill.getString("name"));
                if (prefill.has("email")) prefillJson.put("email", prefill.getString("email"));
                if (prefill.has("contact")) prefillJson.put("contact", prefill.getString("contact"));
                options.put("prefill", prefillJson);
            }

            Log.d(TAG, "Calling checkout.open() now...");
            checkout.open(activity, options);
        } catch (Exception e) {
            Log.e(TAG, "Error opening Razorpay checkout", e);
            call.reject("Could not open payment screen: " + e.getMessage());
            this.pendingCall = null;
        }
    }

    // Called by MainActivity's onPaymentSuccess (the actual SDK listener).
    public void handlePaymentSuccess(String razorpayPaymentId, PaymentData paymentData) {
        Log.d(TAG, "handlePaymentSuccess: " + razorpayPaymentId);
        PluginCall savedCall = bridge.getSavedCall(pendingCall != null ? pendingCall.getCallbackId() : null);
        if (savedCall == null) savedCall = pendingCall;
        if (savedCall == null) return;

        JSObject result = new JSObject();
        result.put("success", true);
        result.put("razorpay_payment_id", razorpayPaymentId);
        if (paymentData != null) {
            if (paymentData.getOrderId() != null) result.put("razorpay_order_id", paymentData.getOrderId());
            if (paymentData.getSignature() != null) result.put("razorpay_signature", paymentData.getSignature());
        }
        savedCall.resolve(result);
        bridge.releaseCall(savedCall);
        pendingCall = null;
    }

    // Called by MainActivity's onPaymentError (the actual SDK listener).
    public void handlePaymentError(int code, String description, PaymentData paymentData) {
        Log.d(TAG, "handlePaymentError: code=" + code + " description=" + description);
        PluginCall savedCall = bridge.getSavedCall(pendingCall != null ? pendingCall.getCallbackId() : null);
        if (savedCall == null) savedCall = pendingCall;
        if (savedCall == null) return;

        JSObject result = new JSObject();
        result.put("success", false);
        result.put("error_code", code);
        result.put("error_description", description);
        savedCall.resolve(result); // resolve, not reject — JS side checks .success
        bridge.releaseCall(savedCall);
        pendingCall = null;
    }
}
