package cn.toside.music.mobile.userApi;

import android.os.Bundle;
import android.os.Handler;
import android.os.Message;
import android.util.Log;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
import java.lang.Thread;
import java.util.HashMap;
import java.util.Map;

public class UserApiModule extends ReactContextBaseJavaModule {
  private final Map<String, JavaScriptThread> runtimes = new HashMap<>();
  private final Map<String, String> tokens = new HashMap<>();
  private final ReactApplicationContext reactContext;
  private UtilsEvent utilsEvent;

  private int listenerCount = 0;

  UserApiModule(ReactApplicationContext reactContext) {
    super(reactContext);
    this.utilsEvent = null;
    this.reactContext = reactContext;
  }

  @Override
  public String getName() {
    return "UserApiModule";
  }

  @ReactMethod
  public void addListener(String eventName) {
    if (listenerCount == 0) {
      // Set up any upstream listeners or background tasks as necessary
    }

    listenerCount += 1;
  }

  @ReactMethod
  public void removeListeners(Integer count) {
    listenerCount -= count;
    if (listenerCount == 0) {
      // Remove upstream listeners, stop unnecessary background tasks
    }
  }

  @ReactMethod
  public void loadScript(ReadableMap data) {
    if (this.utilsEvent == null) this.utilsEvent = new UtilsEvent(this.reactContext);
    Bundle info = Arguments.toBundle(data);
    String apiId = info.getString("id");
    String token = info.getString("token");
    destroy(apiId);
    JavaScriptThread runtime = new JavaScriptThread(this.reactContext, info);
    Handler mainHandler = new JsHandler(this.reactContext.getMainLooper(), this.utilsEvent, apiId, token);
    runtimes.put(apiId, runtime);
    tokens.put(apiId, token);
    runtime.prepareHandler(mainHandler);
    runtime.setUncaughtExceptionHandler((thread, ex) -> {
      mainHandler.sendMessage(mainHandler.obtainMessage(HandlerWhat.INIT_FAILED, ex.getMessage()));
      Log.e("JavaScriptThread", "Uncaught exception: " + ex.getMessage());
    });
    runtime.getHandler().sendEmptyMessage(HandlerWhat.INIT);
    Log.d("UserApi", "Module Thread id: " + Thread.currentThread().getId());
  }

  @ReactMethod
  public boolean sendAction(String apiId, String token, String action, String info) {
    JavaScriptThread javaScriptThread = runtimes.get(apiId);
    if (javaScriptThread == null || !token.equals(tokens.get(apiId))) return false;
    Handler jsHandler = javaScriptThread.getHandler();
    Message message = jsHandler.obtainMessage();
    message.what = HandlerWhat.ACTION;
    message.obj = new Object[]{action, info};
    jsHandler.sendMessage(message);
    return true;
  }

  @ReactMethod
  public void destroy(String apiId) {
    if (apiId.isEmpty()) {
      for (String id : new java.util.ArrayList<>(runtimes.keySet())) destroy(id);
      return;
    }
    JavaScriptThread runtime = runtimes.remove(apiId);
    tokens.remove(apiId);
    if (runtime == null) return;
    runtime.getHandler().sendEmptyMessage(HandlerWhat.DESTROY);
    runtime.stopThread();
  }
}
