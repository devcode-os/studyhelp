package com.fdaytalk.studyhelp;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  // Deliberately minimal — no custom WebViewClient, no shouldOverrideUrlLoading,
  // no repaint code. Testing whether Capacitor's default behavior, combined
  // with the ClientRouter removal from Layout.astro, is sufficient on its own.
  // A previous shouldOverrideUrlLoading override that called view.loadUrl()
  // from within itself may have been causing the WebView to report an updated
  // URL without completing a real page load — a known WebView re-entrancy
  // issue — so it's removed here rather than patched, to isolate the test.
}