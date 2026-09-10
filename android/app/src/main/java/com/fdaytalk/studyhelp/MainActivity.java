package com.fdaytalk.studyhelp;

import android.content.res.AssetManager;
import android.os.Bundle;
import android.util.Log;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;
import com.razorpay.PaymentData;
import com.razorpay.PaymentResultWithDataListener;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;

// Razorpay's native SDK requires this listener interface to be implemented
// directly on the Activity passed to checkout.open() — implementing it on
// a separate plugin object silently fails ("probably not implemented in
// your activity"), and neither onPaymentSuccess nor onPaymentError ever
// actually fires, leaving any JS-side "Loading..." state stuck forever.
public class MainActivity extends BridgeActivity implements PaymentResultWithDataListener {

  private static final String TAG = "MainActivity";

  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(RazorpayPlugin.class);
    super.onCreate(savedInstanceState);

    WebView webView = getBridge().getWebView();
    webView.setWebViewClient(new BridgeWebViewClient(getBridge()) {
      @Override
      public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
        if (request.isForMainFrame()) {
          String html = readAssetFile("public/offline.html");
          if (html != null) {
            view.loadDataWithBaseURL(
              "https://studyhelp.fdaytalk.com/",
              html,
              "text/html",
              "UTF-8",
              null
            );
          }
          return;
        }
        super.onReceivedError(view, request, error);
      }
    });
  }

  @Override
  public void onPaymentSuccess(String razorpayPaymentId, PaymentData paymentData) {
    Log.d(TAG, "onPaymentSuccess (Activity-level): " + razorpayPaymentId);
    RazorpayPlugin plugin = RazorpayPlugin.getInstance();
    if (plugin != null) {
      plugin.handlePaymentSuccess(razorpayPaymentId, paymentData);
    }
  }

  @Override
  public void onPaymentError(int code, String description, PaymentData paymentData) {
    Log.d(TAG, "onPaymentError (Activity-level): code=" + code + " description=" + description);
    RazorpayPlugin plugin = RazorpayPlugin.getInstance();
    if (plugin != null) {
      plugin.handlePaymentError(code, description, paymentData);
    }
  }

  private String readAssetFile(String path) {
    try {
      AssetManager assetManager = getAssets();
      InputStream is = assetManager.open(path);
      BufferedReader reader = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8));
      StringBuilder sb = new StringBuilder();
      String line;
      while ((line = reader.readLine()) != null) {
        sb.append(line).append('\n');
      }
      reader.close();
      return sb.toString();
    } catch (Exception e) {
      Log.e(TAG, "Could not read offline.html asset", e);
      return null;
    }
  }
}
