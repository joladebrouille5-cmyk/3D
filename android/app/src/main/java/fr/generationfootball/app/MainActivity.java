package fr.generationfootball.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import android.graphics.Color;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import java.util.Locale;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.webkit.WebViewAssetLoader;

/**
 * Coque WebView : sert les fichiers web embarqués via une origine https locale
 * (WebViewAssetLoader), indispensable pour charger les modules ES hors de file://.
 */
public class MainActivity extends Activity {
    private static final String START_URL = "https://appassets.androidplatform.net/assets/www/index.html";
    private WebView webView;
    private static final int REQ_EXPORT = 41, REQ_IMPORT = 42;
    private String pendingExport = null;
    private ValueCallback<Uri[]> pendingChooser = null;
    private TextToSpeech tts = null;
    private boolean ttsReady = false;

    /** Pont JavaScript : enregistrer un fichier (sauvegarde exportée) là où l'utilisateur le choisit. */
    public class Bridge {
        @JavascriptInterface
        public void saveFile(String name, String content) {
            runOnUiThread(() -> {
                pendingExport = content;
                Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType("application/json");
                i.putExtra(Intent.EXTRA_TITLE, name);
                startActivityForResult(i, REQ_EXPORT);
            });
        }

        /** Commentaire audio : synthèse vocale du téléphone, en français. */
        @JavascriptInterface
        public void speak(String text, boolean urgent) {
            if (tts == null || !ttsReady) return;
            tts.speak(text, urgent ? TextToSpeech.QUEUE_FLUSH : TextToSpeech.QUEUE_ADD, null, "gf");
        }

        @JavascriptInterface
        public void stopSpeaking() { if (tts != null) tts.stop(); }
    }

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        final WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        webView = new WebView(this);
        webView.setBackgroundColor(Color.parseColor("#0f1412"));
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return loader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                // aucune navigation hors de l'application
                return !"appassets.androidplatform.net".equals(request.getUrl().getHost());
            }
        });
        // sans WebChromeClient, les boîtes alert()/confirm() sont ignorées (confirm répond toujours non) ;
        // le sélecteur de fichier sert à importer une sauvegarde
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (pendingChooser != null) pendingChooser.onReceiveValue(null);
                pendingChooser = callback;
                Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType("*/*");
                try { startActivityForResult(i, REQ_IMPORT); } catch (Exception e) { pendingChooser = null; return false; }
                return true;
            }
        });
        webView.addJavascriptInterface(new Bridge(), "GFAndroid");
        tts = new TextToSpeech(this, status -> {
            if (status == TextToSpeech.SUCCESS) {
                int r = tts.setLanguage(Locale.FRENCH);
                ttsReady = r != TextToSpeech.LANG_MISSING_DATA && r != TextToSpeech.LANG_NOT_SUPPORTED;
                tts.setSpeechRate(1.08f);
            }
        });
        setContentView(webView);
        hideSystemBars();
        if (savedInstanceState != null) webView.restoreState(savedInstanceState);
        else webView.loadUrl(START_URL);
    }

    private void hideSystemBars() {
        if (android.os.Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController c = getWindow().getInsetsController();
            if (c != null) {
                c.hide(WindowInsets.Type.systemBars());
                c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        Uri uri = resultCode == RESULT_OK && data != null ? data.getData() : null;
        if (requestCode == REQ_EXPORT) {
            boolean ok = false;
            if (uri != null && pendingExport != null) {
                try (OutputStream out = getContentResolver().openOutputStream(uri)) {
                    if (out != null) { out.write(pendingExport.getBytes(StandardCharsets.UTF_8)); ok = true; }
                } catch (Exception e) { ok = false; }
            }
            pendingExport = null;
            webView.evaluateJavascript("window.gfExported && window.gfExported(" + ok + ")", null);
        } else if (requestCode == REQ_IMPORT && pendingChooser != null) {
            pendingChooser.onReceiveValue(uri != null ? new Uri[] { uri } : null);
            pendingChooser = null;
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        webView.saveState(outState);
    }

    @Override
    protected void onDestroy() {
        if (tts != null) { tts.shutdown(); tts = null; }
        super.onDestroy();
    }

    @Override
    protected void onPause() {
        // l'application en arrière-plan met le match en pause (aucun temps ne s'écoule sans l'utilisateur)
        webView.evaluateJavascript("window.gfPause && window.gfPause()", null);
        webView.onPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        webView.onResume();
        hideSystemBars();
    }

    @SuppressWarnings("deprecation")
    @Override
    public void onBackPressed() {
        // Retour = Échap : ferme d'abord la couche au premier plan, puis ouvre le menu
        webView.evaluateJavascript(
                "window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))", null);
    }
}
