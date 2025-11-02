use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

const BASE_URL: &str = "https://livekenceng.com";

// ==================== Data Structures ====================

#[derive(Debug, Serialize, Deserialize)]
struct ApiResponse<T> {
    success: bool,
    #[serde(flatten)]
    data: Option<T>,
    message: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct LoginRequest {
    email: String,
    password: String,
    machine_id: String,
    app_identifier: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct LoginResponse {
    user: User,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct User {
    pub id: i32,
    pub email: String,
    pub telegram_username: Option<String>,
    pub expiry_date: Option<String>,
    pub machine_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct RedeemLicenseRequest {
    email: String,
    license_key: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RedeemLicenseResponse {
    pub expiry_date: Option<String>,
    pub days_added: Option<i32>,
    pub is_new_member: bool,
}

#[derive(Debug, Serialize, Deserialize)]
struct ChangePasswordRequest {
    email: String,
    current_password: Option<String>,
    new_password: String,
    machine_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ShopeeAccount {
    pub id: i32,
    pub name: String,
    pub is_active: bool,
    pub created_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ShopeeAccountsResponse {
    pub data: Vec<ShopeeAccount>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Niche {
    pub id: i32,
    pub name: String,
    pub description: Option<String>,
    #[serde(default)]
    pub product_sets: Vec<ProductSet>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NichesResponse {
    pub niches: Vec<Niche>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProductSet {
    pub id: i32,
    pub name: String,
    pub description: Option<String>,
    pub niche_id: Option<i32>,
    #[serde(default)]
    pub items: Vec<ProductSetItem>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProductSetsResponse {
    pub product_sets: Vec<ProductSet>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProductSetItem {
    pub id: i32,
    pub url: String,
    pub shop_id: Option<i64>,
    pub item_id: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SessionIdsResponse {
    pub session_ids: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct ActiveSessionApiResponse {
    pub success: bool,
    #[serde(deserialize_with = "deserialize_session_id")]
    pub session_id: Option<String>,
    pub message: Option<String>,
}

// Helper function to deserialize session_id which can be either a number, string, or null
fn deserialize_session_id<'de, D>(deserializer: D) -> Result<Option<String>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    use serde::de::{Deserialize, Visitor};
    use std::fmt;

    struct SessionIdVisitor;

    impl<'de> Visitor<'de> for SessionIdVisitor {
        type Value = Option<String>;

        fn expecting(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
            formatter.write_str("a string, number, or null")
        }

        fn visit_none<E>(self) -> Result<Self::Value, E>
        where
            E: serde::de::Error,
        {
            Ok(None)
        }

        fn visit_some<D>(self, deserializer: D) -> Result<Self::Value, D::Error>
        where
            D: serde::Deserializer<'de>,
        {
            // Try to deserialize as Value first to handle both string and number
            let value: serde_json::Value = Deserialize::deserialize(deserializer)?;
            match value {
                serde_json::Value::String(s) => Ok(Some(s)),
                serde_json::Value::Number(n) => Ok(Some(n.to_string())),
                serde_json::Value::Null => Ok(None),
                _ => Err(serde::de::Error::invalid_type(
                    serde::de::Unexpected::Other("expected string, number, or null"),
                    &self,
                )),
            }
        }

        fn visit_str<E>(self, v: &str) -> Result<Self::Value, E>
        where
            E: serde::de::Error,
        {
            Ok(Some(v.to_string()))
        }

        fn visit_i64<E>(self, v: i64) -> Result<Self::Value, E>
        where
            E: serde::de::Error,
        {
            Ok(Some(v.to_string()))
        }

        fn visit_u64<E>(self, v: u64) -> Result<Self::Value, E>
        where
            E: serde::de::Error,
        {
            Ok(Some(v.to_string()))
        }
    }

    deserializer.deserialize_option(SessionIdVisitor)
}

// QR Code structures
#[derive(Debug, Serialize, Deserialize)]
pub struct ShopeeQRData {
    pub qrcode_id: String,
    pub qrcode_base64: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct ShopeeQRResponse {
    error: i32,
    error_msg: Option<String>,
    data: Option<ShopeeQRData>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct QRStatusData {
    pub qrcode_token: String,
    pub status: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct ShopeeQRStatusResponse {
    error: i32,
    error_msg: Option<String>,
    data: Option<QRStatusData>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AppQRStatus {
    pub status: String,
    pub qrcode_token: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct QRCodeLoginRequest {
    qrcode_token: String,
    device_sz_fingerprint: String,
    client_identifier: ClientIdentifier,
}

#[derive(Debug, Serialize, Deserialize)]
struct ClientIdentifier {
    security_device_fingerprint: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct QRCodeLoginResponse {
    bff_meta: Option<serde_json::Value>,
    error: i32,
    error_msg: Option<String>,
    data: Option<serde_json::Value>,
}

#[derive(Debug, Serialize)]
pub struct LoginResult {
    pub success: bool,
    pub cookies: Option<String>,
    pub error_msg: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ShopeeAccountInfo {
    pub userid: i64,
    pub username: String,
    pub nickname: String,
    pub email: Option<String>,
    pub phone: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct ShopeeAccountInfoResponse {
    error: i32,
    error_msg: Option<String>,
    data: Option<ShopeeAccountInfo>,
}

// ==================== Utility Functions ====================

fn generate_machine_id() -> String {
    // Generate consistent machine ID based on hardware info
    // For simplicity, we'll use a hash of system info
    // In production, you might want to use systeminfo crate or similar
    use std::env;
    let hostname = env::var("COMPUTERNAME").or_else(|_| env::var("HOSTNAME")).unwrap_or_else(|_| "unknown".to_string());
    let user = env::var("USER").or_else(|_| env::var("USERNAME")).unwrap_or_else(|_| "unknown".to_string());
    
    let combined = format!("{}-{}", hostname, user);
    let mut hasher = Sha256::new();
    hasher.update(combined.as_bytes());
    hex::encode(hasher.finalize())[..16].to_string()
}

fn get_or_generate_machine_id() -> String {
    // Try to get from a simple file-based storage or generate new
    // For now, just generate consistently
    generate_machine_id()
}

async fn make_api_request<T: for<'de> Deserialize<'de>>(
    method: &str,
    endpoint: &str,
    body: Option<&serde_json::Value>,
    query_params: Option<&str>,
) -> Result<T, String> {
    let client = reqwest::Client::new();
    let mut url = format!("{}{}", BASE_URL, endpoint);
    
    if let Some(query) = query_params {
        url = format!("{}?{}", url, query);
    }
    
    // Log API request
    println!("[API REQUEST] {} {}", method, url);
    if let Some(json_body) = body {
        let body_str = serde_json::to_string_pretty(json_body).unwrap_or_else(|_| "Failed to serialize".to_string());
        println!("[API REQUEST BODY]\n{}", body_str);
    }
    if let Some(query) = query_params {
        println!("[API REQUEST QUERY] {}", query);
    }
    
    let mut request = match method {
        "GET" => client.get(&url),
        "POST" => client.post(&url),
        "PUT" => client.put(&url),
        "DELETE" => client.delete(&url),
        _ => return Err("Invalid HTTP method".to_string()),
    };
    
    if let Some(json_body) = body {
        request = request.json(json_body);
    }
    
    if method != "GET" || body.is_some() {
        request = request.header("Content-Type", "application/json");
    }
    
    let response = request
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;
    
    let status = response.status();
    let text = response.text().await.map_err(|e| format!("Failed to read response: {}", e))?;
    
    // Log API response
    println!("[API RESPONSE] HTTP {} {}", status, endpoint);
    if text.len() < 500 {
        println!("[API RESPONSE BODY]\n{}", text);
    } else {
        println!("[API RESPONSE BODY] (truncated, {} chars)\n{}", text.len(), &text[..500]);
    }
    
    if !status.is_success() {
        println!("[API ERROR] HTTP {}: {}", status, text);
        return Err(format!("HTTP {}: {}", status, text));
    }
    
    match serde_json::from_str::<T>(&text) {
        Ok(parsed) => {
            println!("[API SUCCESS] Parsed response successfully");
            Ok(parsed)
        }
        Err(e) => {
            println!("[API PARSE ERROR] {} - Response: {}", e, text);
            Err(format!("Failed to parse response: {} - {}", e, text))
        }
    }
}

// ==================== Tauri Commands ====================

#[tauri::command]
async fn get_machine_id() -> Result<String, String> {
    Ok(get_or_generate_machine_id())
}

#[derive(Debug, Serialize, Deserialize)]
struct MachineIdResponse {
    success: bool,
    email: String,
    machine_id: String,
    app_identifier: Option<String>,
}

#[tauri::command]
async fn get_user_machine_id(email: String) -> Result<MachineIdResponse, String> {
    let encoded_email = urlencoding::encode(&email);
    // Endpoint already includes query param in URL
    let endpoint = format!("/api/members/machine-id/{}?app_identifier=botgacor", encoded_email);
    
    // API returns flat structure, not wrapped in data field
    // Response: {"success":true,"email":"...","machine_id":"...","app_identifier":"..."}
    let response: MachineIdResponse = make_api_request("GET", &endpoint, None, None).await?;
    
    if !response.success {
        return Err("Failed to get machine ID from server".to_string());
    }
    
    Ok(response)
}

#[tauri::command]
async fn login(email: String, password: String, machine_id: String) -> Result<LoginResponse, String> {
    let request = LoginRequest {
        email,
        password,
        machine_id,
        app_identifier: "botgacor".to_string(),
    };
    
    let response: ApiResponse<LoginResponse> = make_api_request("POST", "/api/members/login", Some(&serde_json::to_value(request).unwrap()), None).await?;
    
    if !response.success {
        return Err(response.message.unwrap_or_else(|| "Login failed".to_string()));
    }
    
    response.data.ok_or_else(|| "No user data in response".to_string())
}

#[tauri::command]
async fn redeem_license(email: String, license_key: String) -> Result<RedeemLicenseResponse, String> {
    let request = RedeemLicenseRequest {
        email,
        license_key,
    };
    
    let response: ApiResponse<RedeemLicenseResponse> = make_api_request("POST", "/api/members/redeem-license", Some(&serde_json::to_value(request).unwrap()), None).await?;
    
    if !response.success {
        return Err(response.message.unwrap_or_else(|| "Redeem failed".to_string()));
    }
    
    response.data.ok_or_else(|| "No data in response".to_string())
}

#[tauri::command]
async fn update_machine_id(email: String, machine_id: String, password: Option<String>) -> Result<(), String> {
    let mut body = serde_json::json!({
        "email": email,
        "machine_id": machine_id,
        "app_identifier": "botgacor"
    });
    
    // Include password if provided (for force update after machine ID mismatch)
    if let Some(pwd) = password {
        body["password"] = serde_json::Value::String(pwd);
    }
    
    let response: ApiResponse<serde_json::Value> = make_api_request("POST", "/api/members/machine-id", Some(&body), None).await?;
    
    if !response.success {
        return Err(response.message.unwrap_or_else(|| "Failed to update machine ID".to_string()));
    }
    
    Ok(())
}

#[tauri::command]
async fn change_password(email: String, new_password: String, machine_id: String) -> Result<(), String> {
    let request = ChangePasswordRequest {
        email,
        current_password: None,
        new_password,
        machine_id,
    };
    
    let response: ApiResponse<serde_json::Value> = make_api_request("POST", "/api/members/change-password", Some(&serde_json::to_value(request).unwrap()), None).await?;
    
    if !response.success {
        return Err(response.message.unwrap_or_else(|| "Change password failed".to_string()));
    }
    
    Ok(())
}

#[tauri::command]
async fn get_shopee_accounts(email: String, password: String) -> Result<ShopeeAccountsResponse, String> {
    let query = format!("email={}&password={}", urlencoding::encode(&email), urlencoding::encode(&password));
    let response: ApiResponse<ShopeeAccountsResponse> = make_api_request("GET", "/api/members/shopee-accounts", None, Some(&query)).await?;
    
    if !response.success {
        return Err(response.message.unwrap_or_else(|| "Failed to get accounts".to_string()));
    }
    
    response.data.ok_or_else(|| "No data in response".to_string())
}

#[tauri::command]
async fn add_shopee_account(email: String, password: String, name: String, cookie: String, is_active: bool) -> Result<ShopeeAccount, String> {
    let body = serde_json::json!({
        "email": email,
        "password": password,
        "name": name,
        "cookie": cookie,
        "is_active": is_active
    });
    
    let response: ApiResponse<serde_json::Value> = make_api_request("POST", "/api/members/shopee-accounts", Some(&body), None).await?;
    
    if !response.success {
        return Err(response.message.unwrap_or_else(|| "Failed to add account".to_string()));
    }
    
    // Parse the data field
    let data = response.data.ok_or_else(|| "No data in response".to_string())?;
    let account: ShopeeAccount = serde_json::from_value(data["data"].clone()).map_err(|e| format!("Failed to parse account: {}", e))?;
    Ok(account)
}

#[tauri::command]
async fn update_shopee_account(email: String, password: String, account_id: i32, name: String, cookie: String, is_active: bool) -> Result<ShopeeAccount, String> {
    let body = serde_json::json!({
        "email": email,
        "password": password,
        "name": name,
        "cookie": cookie,
        "is_active": is_active
    });
    
    let response: ApiResponse<serde_json::Value> = make_api_request("PUT", &format!("/api/members/shopee-accounts/{}", account_id), Some(&body), None).await?;
    
    if !response.success {
        return Err(response.message.unwrap_or_else(|| "Failed to update account".to_string()));
    }
    
    let data = response.data.ok_or_else(|| "No data in response".to_string())?;
    let account: ShopeeAccount = serde_json::from_value(data["shopee_account"].clone()).map_err(|e| format!("Failed to parse account: {}", e))?;
    Ok(account)
}

#[tauri::command]
async fn delete_shopee_account(email: String, password: String, account_id: i32) -> Result<(), String> {
    let body = serde_json::json!({
        "email": email,
        "password": password
    });
    
    let response: ApiResponse<serde_json::Value> = make_api_request("DELETE", &format!("/api/members/shopee-accounts/{}", account_id), Some(&body), None).await?;
    
    if !response.success {
        return Err(response.message.unwrap_or_else(|| "Failed to delete account".to_string()));
    }
    
    Ok(())
}

#[tauri::command]
async fn get_niches(email: String, password: String) -> Result<NichesResponse, String> {
    let body = serde_json::json!({
        "email": email,
        "password": password
    });
    
    let response: ApiResponse<NichesResponse> = make_api_request("GET", "/api/members/niches", Some(&body), None).await?;
    
    if !response.success {
        return Err(response.message.unwrap_or_else(|| "Failed to get niches".to_string()));
    }
    
    response.data.ok_or_else(|| "No data in response".to_string())
}

#[tauri::command]
async fn create_niche(email: String, password: String, name: String, description: Option<String>) -> Result<Niche, String> {
    let mut body = serde_json::json!({
        "email": email,
        "password": password,
        "name": name
    });
    if let Some(desc) = description {
        body["description"] = serde_json::Value::String(desc);
    }
    
    let response: ApiResponse<serde_json::Value> = make_api_request("POST", "/api/members/niches", Some(&body), None).await?;
    
    if !response.success {
        return Err(response.message.unwrap_or_else(|| "Failed to create niche".to_string()));
    }
    
    let data = response.data.ok_or_else(|| "No data in response".to_string())?;
    let niche: Niche = serde_json::from_value(data["niche"].clone()).map_err(|e| format!("Failed to parse niche: {}", e))?;
    Ok(niche)
}

#[tauri::command]
async fn update_niche(email: String, password: String, niche_id: i32, name: String, description: Option<String>) -> Result<(), String> {
    let mut body = serde_json::json!({
        "email": email,
        "password": password,
        "name": name
    });
    if let Some(desc) = description {
        body["description"] = serde_json::Value::String(desc);
    }
    
    let response: ApiResponse<serde_json::Value> = make_api_request("PUT", &format!("/api/members/niches/{}", niche_id), Some(&body), None).await?;
    
    if !response.success {
        return Err(response.message.unwrap_or_else(|| "Failed to update niche".to_string()));
    }
    
    Ok(())
}

#[tauri::command]
async fn delete_niche(email: String, password: String, niche_id: i32) -> Result<(), String> {
    let body = serde_json::json!({
        "email": email,
        "password": password
    });
    
    let response: ApiResponse<serde_json::Value> = make_api_request("DELETE", &format!("/api/members/niches/{}", niche_id), Some(&body), None).await?;
    
    if !response.success {
        return Err(response.message.unwrap_or_else(|| "Failed to delete niche".to_string()));
    }
    
    Ok(())
}

#[tauri::command]
async fn get_product_sets(email: String, password: String) -> Result<ProductSetsResponse, String> {
    let body = serde_json::json!({
        "email": email,
        "password": password
    });
    
    let response: ApiResponse<ProductSetsResponse> = make_api_request("GET", "/api/members/product-sets", Some(&body), None).await?;
    
    if !response.success {
        return Err(response.message.unwrap_or_else(|| "Failed to get product sets".to_string()));
    }
    
    response.data.ok_or_else(|| "No data in response".to_string())
}

#[tauri::command]
async fn create_product_set(email: String, password: String, name: String, description: Option<String>, niche_id: Option<i32>) -> Result<ProductSet, String> {
    let mut body = serde_json::json!({
        "email": email,
        "password": password,
        "name": name
    });
    if let Some(desc) = description {
        body["description"] = serde_json::Value::String(desc);
    }
    if let Some(nid) = niche_id {
        body["niche_id"] = serde_json::Value::Number(nid.into());
    }
    
    let response: ApiResponse<serde_json::Value> = make_api_request("POST", "/api/members/product-sets", Some(&body), None).await?;
    
    if !response.success {
        return Err(response.message.unwrap_or_else(|| "Failed to create product set".to_string()));
    }
    
    let data = response.data.ok_or_else(|| "No data in response".to_string())?;
    let product_set: ProductSet = serde_json::from_value(data["product_set"].clone()).map_err(|e| format!("Failed to parse product set: {}", e))?;
    Ok(product_set)
}

#[tauri::command]
async fn update_product_set(email: String, password: String, product_set_id: i32, name: String, description: Option<String>, niche_id: Option<i32>) -> Result<(), String> {
    let mut body = serde_json::json!({
        "email": email,
        "password": password,
        "name": name
    });
    if let Some(desc) = description {
        body["description"] = serde_json::Value::String(desc);
    }
    if let Some(nid) = niche_id {
        body["niche_id"] = serde_json::Value::Number(nid.into());
    }
    
    let response: ApiResponse<serde_json::Value> = make_api_request("PUT", &format!("/api/members/product-sets/{}", product_set_id), Some(&body), None).await?;
    
    if !response.success {
        return Err(response.message.unwrap_or_else(|| "Failed to update product set".to_string()));
    }
    
    Ok(())
}

#[tauri::command]
async fn delete_product_set(email: String, password: String, product_set_id: i32) -> Result<(), String> {
    let body = serde_json::json!({
        "email": email,
        "password": password
    });
    
    let response: ApiResponse<serde_json::Value> = make_api_request("DELETE", &format!("/api/members/product-sets/{}", product_set_id), Some(&body), None).await?;
    
    if !response.success {
        return Err(response.message.unwrap_or_else(|| "Failed to delete product set".to_string()));
    }
    
    Ok(())
}

#[tauri::command]
async fn add_product_set_items(email: String, password: String, product_set_id: i32, items: Vec<serde_json::Value>) -> Result<serde_json::Value, String> {
    let body = serde_json::json!({
        "email": email,
        "password": password,
        "items": items
    });
    
    let response: ApiResponse<serde_json::Value> = make_api_request("POST", &format!("/api/members/product-sets/{}/items", product_set_id), Some(&body), None).await?;
    
    if !response.success {
        return Err(response.message.unwrap_or_else(|| "Failed to add items".to_string()));
    }
    
    Ok(response.data.unwrap_or_else(|| serde_json::json!({})))
}

#[tauri::command]
async fn delete_product_set_item(email: String, password: String, product_set_id: i32, item_id: i32) -> Result<(), String> {
    let body = serde_json::json!({
        "email": email,
        "password": password
    });
    
    let response: ApiResponse<serde_json::Value> = make_api_request("DELETE", &format!("/api/members/product-sets/{}/items/{}", product_set_id, item_id), Some(&body), None).await?;
    
    if !response.success {
        return Err(response.message.unwrap_or_else(|| "Failed to delete item".to_string()));
    }
    
    Ok(())
}

#[tauri::command]
async fn clear_product_set_items(email: String, password: String, product_set_id: i32) -> Result<(), String> {
    let body = serde_json::json!({
        "email": email,
        "password": password
    });
    
    let response: ApiResponse<serde_json::Value> = make_api_request("DELETE", &format!("/api/members/product-sets/{}/items", product_set_id), Some(&body), None).await?;
    
    if !response.success {
        return Err(response.message.unwrap_or_else(|| "Failed to clear items".to_string()));
    }
    
    Ok(())
}

#[tauri::command]
async fn get_session_ids(email: String, password: String, shopee_account_id: i32) -> Result<SessionIdsResponse, String> {
    let body = serde_json::json!({
        "email": email,
        "password": password,
        "shopee_account_id": shopee_account_id
    });
    
    // Use new active-session endpoint which returns only one active session or null
    let response: ActiveSessionApiResponse = make_api_request("POST", "/api/shopee-live/active-session", Some(&body), None).await?;
    
    if !response.success {
        return Err(response.message.unwrap_or_else(|| "Failed to get active session".to_string()));
    }
    
    // Convert Option<String> to Vec<String> for compatibility with frontend
    let session_ids = match response.session_id {
        Some(sid) => vec![sid],
        None => vec![],
    };
    
    Ok(SessionIdsResponse {
        session_ids,
    })
}

#[tauri::command]
async fn replace_products(email: String, password: String, shopee_account_id: i32, session_id: String, product_set_id: i32) -> Result<serde_json::Value, String> {
    let body = serde_json::json!({
        "email": email,
        "password": password,
        "shopee_account_id": shopee_account_id,
        "session_id": session_id,
        "product_set_id": product_set_id
    });
    
    let response: ApiResponse<serde_json::Value> = make_api_request("POST", "/api/shopee-live/replace-products", Some(&body), None).await?;
    
    if !response.success {
        return Err(response.message.unwrap_or_else(|| "Failed to replace products".to_string()));
    }
    
    Ok(response.data.unwrap_or_else(|| serde_json::json!({})))
}

#[tauri::command]
async fn clear_products(email: String, password: String, shopee_account_id: i32, session_id: String) -> Result<(), String> {
    let body = serde_json::json!({
        "email": email,
        "password": password,
        "shopee_account_id": shopee_account_id,
        "session_id": session_id
    });
    
    let response: ApiResponse<serde_json::Value> = make_api_request("POST", "/api/shopee-live/clear-products", Some(&body), None).await?;
    
    if !response.success {
        return Err(response.message.unwrap_or_else(|| "Failed to clear products".to_string()));
    }
    
    Ok(())
}

// QR Code commands
#[tauri::command]
async fn generate_shopee_qr() -> Result<ShopeeQRData, String> {
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36")
        .build()
        .map_err(|e| format!("Failed to create client: {}", e))?;
    
    let response = client
        .get("https://shopee.co.id/api/v2/authentication/gen_qrcode")
        .header("Accept", "application/json, text/plain")
        .header("Accept-Language", "en-US,en;q=0.9")
        .header("Origin", "https://shopee.co.id")
        .header("Referer", "https://shopee.co.id/")
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;
    
    let status = response.status();
    let text = response.text().await.map_err(|e| format!("Failed to read response: {}", e))?;
    
    if !status.is_success() {
        return Err(format!("HTTP {}: {}", status, text));
    }
    
    let qr_response: ShopeeQRResponse = serde_json::from_str(&text)
        .map_err(|e| format!("Failed to parse response: {} - Response: {}", e, text))?;
    
    if qr_response.error != 0 {
        return Err(format!("Shopee API error: {} - {}", 
            qr_response.error, 
            qr_response.error_msg.unwrap_or("Unknown error".to_string())));
    }
    
    qr_response.data.ok_or_else(|| "Invalid response from Shopee API".to_string())
}

#[tauri::command]
async fn check_qr_status(qrcode_id: String) -> Result<AppQRStatus, String> {
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36")
        .build()
        .map_err(|e| format!("Failed to create client: {}", e))?;
    
    let url = format!("https://shopee.co.id/api/v2/authentication/qrcode_status?qrcode_id={}", 
                     urlencoding::encode(&qrcode_id));
    
    let response = client
        .get(&url)
        .header("Accept", "application/json, text/plain")
        .header("Accept-Language", "en-US,en;q=0.9")
        .header("Origin", "https://shopee.co.id")
        .header("Referer", "https://shopee.co.id/")
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;
    
    let status = response.status();
    let text = response.text().await.map_err(|e| format!("Failed to read response: {}", e))?;
    
    if !status.is_success() {
        return Err(format!("HTTP {}: {}", status, text));
    }
    
    let status_response: ShopeeQRStatusResponse = serde_json::from_str(&text)
        .map_err(|e| format!("Failed to parse response: {} - Response: {}", e, text))?;
    
    if status_response.error != 0 {
        return Err(format!("Shopee API error: {} - {}",
            status_response.error,
            status_response.error_msg.unwrap_or("Unknown error".to_string())));
    }
    
    let data = status_response.data.ok_or_else(|| "No data in response".to_string())?;
    
    Ok(AppQRStatus {
        status: data.status,
        qrcode_token: if data.qrcode_token.is_empty() { None } else { Some(data.qrcode_token) },
    })
}

#[tauri::command]
async fn qr_login(qrcode_token: String) -> Result<LoginResult, String> {
    let device_sz_fingerprint = "Eci2goR2Eb+MxmnU3gKNBQ==|U4oBUb+lXscV+6i8liMV/0lL2YjLYCw6ZgvAg3AVpmc=|WYw++VlzfflxOp1j|08|3".to_string();
    let security_device_fingerprint = "vRr1CLNxsx/YWsLqNCAeGQ==|3UI1dXTNSZRQkHYpKyn3MGV94+BUZv/37sidjlGODXY=|77wWZwahX4xYgzK9BHP57A==".to_string();

    let payload = QRCodeLoginRequest {
        qrcode_token,
        device_sz_fingerprint,
        client_identifier: ClientIdentifier {
            security_device_fingerprint,
        },
    };

    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36")
        .build()
        .map_err(|e| format!("Failed to create client: {}", e))?;

    let response = client
        .post("https://shopee.co.id/api/v2/authentication/qrcode_login")
        .header("Accept", "application/json")
        .header("Content-Type", "application/json")
        .header("X-Sz-Sdk-Version", "3.3.0-2&1.6.6")
        .header("X-Api-Source", "pc")
        .header("X-Shopee-Language", "id")
        .header("X-Requested-With", "XMLHttpRequest")
        .header("Af-Ac-Enc-Sz-Token", "LKhci5u+IZWG5pLadxISkw==|KnTeDESKZrvJIH7v/k87MkjZgllq1OIb4WNTbBMjqiX47UKmLiYT/5gQveB5AcnnWrX7QOH0K22Cyg==|WYw++VlzfflxOp1j|08|3")
        .header("Sec-Ch-Ua-Platform", "\"macOS\"")
        .header("Origin", "https://shopee.co.id")
        .header("Referer", "https://shopee.co.id/buyer/login/qr?next=https%3A%2F%2Fshopee.co.id%2F")
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    let status = response.status();
    
    let set_cookie_headers: Vec<String> = response
        .headers()
        .get_all("set-cookie")
        .iter()
        .filter_map(|v| v.to_str().ok().map(|s| s.to_string()))
        .collect();

    let text = response.text().await.map_err(|e| format!("Failed to read response: {}", e))?;
    
    if !status.is_success() {
        return Ok(LoginResult {
            success: false,
            cookies: None,
            error_msg: Some(format!("HTTP {}: {}", status, text)),
        });
    }
    
    let login_response: QRCodeLoginResponse = serde_json::from_str(&text)
        .map_err(|e| format!("Failed to parse response: {} - Response: {}", e, text))?;
    
    if login_response.error != 0 {
        return Ok(LoginResult {
            success: false,
            cookies: None,
            error_msg: login_response.error_msg,
        });
    }
    
    let cookies = set_cookie_headers.join("; ");
    
    Ok(LoginResult {
        success: true,
        cookies: Some(cookies),
        error_msg: None,
    })
}

#[tauri::command]
async fn get_account_info(cookies: String) -> Result<ShopeeAccountInfo, String> {
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36")
        .build()
        .map_err(|e| format!("Failed to create client: {}", e))?;
    
    let response = client
        .get("https://shopee.co.id/api/v4/account/basic/get_account_info")
        .header("Cookie", cookies)
        .header("Accept", "application/json")
        .header("Origin", "https://shopee.co.id")
        .header("Referer", "https://shopee.co.id/")
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;
    
    let status = response.status();
    let text = response.text().await.map_err(|e| format!("Failed to read response: {}", e))?;
    
    if !status.is_success() {
        return Err(format!("HTTP {}: {}", status, text));
    }
    
    let info_response: ShopeeAccountInfoResponse = serde_json::from_str(&text)
        .map_err(|e| format!("Failed to parse response: {} - Response: {}", e, text))?;
    
    if info_response.error != 0 {
        return Err(format!("Shopee API error: {} - {}",
            info_response.error,
            info_response.error_msg.unwrap_or("Unknown error".to_string())));
    }
    
    info_response.data.ok_or_else(|| "No account info in response".to_string())
}

#[tauri::command]
async fn close_window(window: tauri::Window) {
    window.close().unwrap_or_else(|e| {
        eprintln!("Failed to close window: {}", e);
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_machine_id,
            get_user_machine_id,
            close_window,
            login,
            redeem_license,
            update_machine_id,
            change_password,
            get_shopee_accounts,
            add_shopee_account,
            update_shopee_account,
            delete_shopee_account,
            get_niches,
            create_niche,
            update_niche,
            delete_niche,
            get_product_sets,
            create_product_set,
            update_product_set,
            delete_product_set,
            add_product_set_items,
            delete_product_set_item,
            clear_product_set_items,
            get_session_ids,
            replace_products,
            clear_products,
            generate_shopee_qr,
            check_qr_status,
            qr_login,
            get_account_info,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
