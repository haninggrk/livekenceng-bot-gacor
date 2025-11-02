import { invoke } from "@tauri-apps/api/core";

// ==================== Types ====================

interface User {
  id: number;
  email: string;
  telegram_username?: string;
  expiry_date?: string;
  machine_id: string;
}

interface ShopeeAccount {
  id: number;
  name: string;
  is_active: boolean;
  created_at?: string;
}

interface Niche {
  id: number;
  name: string;
  description?: string;
  product_sets: ProductSet[];
}

interface ProductSet {
  id: number;
  name: string;
  description?: string;
  niche_id?: number;
  items: ProductSetItem[];
}

interface ProductSetItem {
  id: number;
  url: string;
  shop_id?: number;
  item_id?: number;
}

interface AppState {
  currentUser: User | null;
  currentPassword: string; // Store password for API calls
  currentStep: number;
  selectedAccount: ShopeeAccount | null;
  selectedNiche: Niche | null;
  selectedProductSets: ProductSet[];
  delay: number;
  errorCount: number;
  isBotRunning: boolean;
  botIntervalId: number | null;
  sessionId: string | null; // Single session ID for selected account (or null if no active session)
  currentProductSetIndex: number; // Current product set being used in rotation
}

// ==================== State ====================

const state: AppState = {
  currentUser: null,
  currentPassword: "",
  currentStep: 0,
  selectedAccount: null,
  selectedNiche: null,
  selectedProductSets: [],
  delay: 60,
  errorCount: 0,
  isBotRunning: false,
  botIntervalId: null,
  sessionId: null,
  currentProductSetIndex: 0,
};

// ==================== Utility Functions ====================

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Element with id "${id}" not found`);
  return el as T;
}

function showToast(message: string, type: "success" | "error" | "info" = "info") {
  const container = byId<HTMLDivElement>("toast-container");
  const toast = document.createElement("div");
  
  const colors = {
    success: "border-green-200 bg-green-50 text-green-800",
    error: "border-red-200 bg-red-50 text-red-800",
    info: "border-blue-200 bg-blue-50 text-blue-800",
  };
  
  toast.className = `rounded-lg border p-3 text-sm shadow-lg ${colors[type]}`;
  toast.textContent = message;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.remove();
  }, 5000);
}

async function showStep(step: number) {
  for (let i = 0; i <= 3; i++) {
    const stepEl = byId(`step-${i}`);
    stepEl.classList.toggle("hidden", i !== step);
  }
  state.currentStep = step;
  
  // Update step info displays
  if (step === 2 && state.selectedAccount) {
    byId("step-2-account-name").textContent = state.selectedAccount.name;
    byId("step-2-info").classList.remove("hidden");
  } else if (step === 2) {
    byId("step-2-info").classList.add("hidden");
  }
  
  if (step === 3) {
    console.log("Entering Step 3", {
      selectedAccount: state.selectedAccount,
      selectedNiche: state.selectedNiche,
      hasUser: !!state.currentUser,
      selectedProductSetsCount: state.selectedProductSets.length
    });
    
    const delayInput = byId<HTMLInputElement>("delay-input");
    if (delayInput) {
      delayInput.value = state.delay.toString();
    }
    
    // Update step 3 info
    if (state.selectedAccount) {
      byId("step-3-account-name").textContent = state.selectedAccount.name;
      const botAccountName = document.getElementById("bot-account-name");
      if (botAccountName) botAccountName.textContent = state.selectedAccount.name;
    } else {
      console.error("No selected account when entering Step 3!");
      byId("step-3-account-name").textContent = "Akun belum dipilih";
      const botAccountName = document.getElementById("bot-account-name");
      if (botAccountName) botAccountName.textContent = "Akun belum dipilih";
    }
    if (state.selectedNiche) {
      byId("step-3-niche-name").textContent = state.selectedNiche.name;
      const botNicheName = document.getElementById("bot-niche-name");
      if (botNicheName) botNicheName.textContent = state.selectedNiche.name;
      
      // Reload product sets to ensure we have full data with items
      console.log("Reloading product sets for niche:", state.selectedNiche.id);
      await loadProductSetsForNiche(state.selectedNiche.id);
      console.log("Product sets loaded:", state.selectedProductSets.map(ps => ({
        id: ps.id,
        name: ps.name,
        itemsCount: ps.items?.length || 0
      })));
    }
    
    // Render product sets rotation visualization
    renderProductSetsRotation();
    
    // Check sessions before showing Step 3
    console.log("About to call checkSessions() from showStep(3)");
    await checkSessions();
  }
}

function showModal(modalId: string) {
  const modal = byId<HTMLDivElement>(modalId);
  modal.classList.remove("hidden");
}

function hideModal(modalId: string) {
  const modal = byId<HTMLDivElement>(modalId);
  modal.classList.add("hidden");
}

// Custom confirmation function (replace window.confirm for Tauri compatibility)
function confirmDialog(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    byId("confirm-message").textContent = message;
    showModal("modal-confirm");
    
    const okBtn = byId("btn-confirm-ok");
    const cancelBtn = byId("btn-confirm-cancel");
    
    const cleanup = () => {
      okBtn.removeEventListener("click", handleOk);
      cancelBtn.removeEventListener("click", handleCancel);
    };
    
    const handleOk = () => {
      cleanup();
      hideModal("modal-confirm");
      resolve(true);
    };
    
    const handleCancel = () => {
      cleanup();
      hideModal("modal-confirm");
      resolve(false);
    };
    
    okBtn.addEventListener("click", handleOk);
    cancelBtn.addEventListener("click", handleCancel);
  });
}

// ==================== Step 0: Login ====================

async function handleLogin(event: Event) {
  event.preventDefault();
  
  const email = byId<HTMLInputElement>("login-email").value;
  const password = byId<HTMLInputElement>("login-password").value;
  const statusEl = byId("login-status");
  
  const machineId = await invoke<string>("get_machine_id");
  
  try {
    const loginResult = await invoke<{ user: User }>("login", {
      email,
      password,
      machineId,
    });
    
    state.currentUser = loginResult.user;
    state.currentPassword = password; // Store password for later API calls
    
    // Verify/update machine_id
    if (state.currentUser.machine_id !== machineId) {
      try {
        await invoke("update_machine_id", {
          email: state.currentUser.email,
          machineId,
        });
      } catch (error) {
        console.error("Failed to update machine_id:", error);
      }
    }
    
    statusEl.className = "mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800";
    statusEl.textContent = "Login berhasil!";
    
    setTimeout(() => {
      byId("global-header").classList.remove("hidden");
      showStep(1);
      loadShopeeAccounts();
    }, 1000);
    
  } catch (error) {
    const errorMessage = String(error);
    
    // Check if it's a machine ID mismatch error (401 with machine ID message)
    const isMachineIdMismatch = errorMessage.includes("401") && 
                                (errorMessage.includes("Machine ID mismatch") || 
                                 errorMessage.includes("machine"));
    
    if (isMachineIdMismatch) {
      // Show confirmation dialog
      const confirmed = await confirmDialog(
        "Akun ini sedang digunakan di perangkat lain.\n\nGanti machine ID dan lanjutkan login?\n\nPerangkat lain akan otomatis logout."
      );
      
      if (confirmed) {
        try {
          statusEl.className = "mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800";
          statusEl.textContent = "Memperbarui machine ID...";
          statusEl.classList.remove("hidden");
          
          // Force update machine ID (include password for authentication)
          await invoke("update_machine_id", {
            email,
            machineId,
            password,
          });
          
          console.log("Machine ID updated successfully, waiting before retry...");
          
          // Wait longer for backend to process and clear cache
          statusEl.textContent = "Menunggu backend memproses update...";
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Retry login with multiple attempts (backend might need time to process)
          let loginResult: { user: User } | null = null;
          let retryCount = 0;
          const maxRetries = 5;
          
          while (retryCount < maxRetries && !loginResult) {
            // Wait before retry (increasing delay: 2s, 3s, 4s, 5s, 6s)
            const delay = 2000 + (retryCount * 1000);
            if (retryCount > 0) {
              statusEl.textContent = `Menunggu ${delay/1000} detik sebelum retry... (${retryCount + 1}/${maxRetries})`;
              await new Promise(resolve => setTimeout(resolve, delay));
            }
            
            statusEl.textContent = `Mencoba login kembali... (${retryCount + 1}/${maxRetries})`;
            console.log(`Login retry attempt ${retryCount + 1}...`);
            
            try {
              loginResult = await invoke<{ user: User }>("login", {
                email,
                password,
                machineId,
              });
              console.log("Login retry successful!");
              break; // Success, exit loop
            } catch (retryError) {
              retryCount++;
              const retryErrorMessage = String(retryError);
              console.log(`Login retry ${retryCount} failed:`, retryErrorMessage);
              
              // If it's still machine ID mismatch, continue retrying
              if (retryErrorMessage.includes("401") && retryErrorMessage.includes("machine")) {
                if (retryCount >= maxRetries) {
                  // Final attempt failed - maybe backend needs more time or different approach
                  console.error("All retry attempts failed with machine ID mismatch");
                  statusEl.className = "mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800";
                  statusEl.textContent = `Gagal login setelah ${maxRetries} percobaan. Backend mungkin memerlukan waktu lebih lama untuk memproses update machine ID. Silakan coba lagi dalam beberapa detik.`;
                  showToast("Machine ID sudah diupdate, tapi login masih gagal. Coba login lagi dalam beberapa detik.", "error");
                  return;
                }
                // Continue to next retry
                continue;
              } else {
                // Different error, throw immediately
                throw retryError;
              }
            }
          }
          
          if (!loginResult) {
            throw new Error("Gagal login setelah memperbarui machine ID setelah beberapa percobaan");
          }
          
          state.currentUser = loginResult.user;
          state.currentPassword = password;
          
          statusEl.className = "mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800";
          statusEl.textContent = "Login berhasil! Machine ID telah diperbarui.";
          
          setTimeout(() => {
            byId("global-header").classList.remove("hidden");
            showStep(1);
            loadShopeeAccounts();
          }, 1000);
          
          showToast("Machine ID berhasil diperbarui. Login berhasil!", "success");
          return;
          
        } catch (retryError) {
          console.error("Failed to update machine ID and retry login:", retryError);
          const retryErrorMessage = String(retryError);
          
          // Try to extract message from JSON response
          let finalErrorMessage = retryErrorMessage;
          try {
            const jsonMatch = retryErrorMessage.match(/\{.*\}/);
            if (jsonMatch) {
              const jsonObj = JSON.parse(jsonMatch[0]);
              if (jsonObj.message) {
                finalErrorMessage = jsonObj.message;
              }
            }
          } catch (e) {
            // Not JSON, use full error message
          }
          
          statusEl.className = "mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800";
          statusEl.textContent = `Gagal memperbarui machine ID: ${finalErrorMessage}`;
          showToast(`Gagal memperbarui machine ID: ${finalErrorMessage}`, "error");
          return;
        }
      } else {
        // User cancelled
        statusEl.className = "mt-4 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800";
        statusEl.textContent = "Login dibatalkan. Machine ID tidak diperbarui.";
        return;
      }
    }
    
    // Handle other errors
    // Extract message from error (format: "HTTP 400: {...}" or just message)
    let errorMsg = errorMessage;
    if (errorMsg.includes("HTTP")) {
      // Try to extract JSON message from response
      const jsonMatch = errorMsg.match(/"message":\s*"([^"]+)"/);
      if (jsonMatch) {
        errorMsg = jsonMatch[1];
      } else {
        // Fallback: extract status code
        const codeMatch = errorMsg.match(/HTTP (\d+)/);
        errorMsg = codeMatch ? `Error ${codeMatch[1]}` : "Login gagal";
      }
    }
    
    statusEl.className = "mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800";
    statusEl.textContent = `Login gagal: ${errorMsg}`;
    showToast(`Login gagal: ${errorMsg}`, "error");
  }
}

async function handleRedeemLicense(event: Event) {
  event.preventDefault();
  
  const email = byId<HTMLInputElement>("redeem-email").value;
  const licenseKey = byId<HTMLInputElement>("redeem-license-key").value;
  
  try {
    const result = await invoke<{
      expiry_date?: string;
      days_added?: number;
      is_new_member: boolean;
    }>("redeem_license", { email, licenseKey });
    
    hideModal("modal-redeem-license");
    
    if (result.is_new_member) {
      // Show change password modal
      byId<HTMLInputElement>("change-password-email").value = email;
      showModal("modal-change-password");
      showToast("Akun baru dibuat! Silakan buat password baru.", "info");
    } else {
      showToast(`License berhasil ditukarkan! ${result.days_added || 0} hari ditambahkan.`, "success");
    }
    
  } catch (error) {
    // Extract message from error
    let errorMessage = String(error);
    if (errorMessage.includes("HTTP")) {
      const jsonMatch = errorMessage.match(/"message":\s*"([^"]+)"/);
      if (jsonMatch) {
        errorMessage = jsonMatch[1];
      } else {
        const codeMatch = errorMessage.match(/HTTP (\d+)/);
        errorMessage = codeMatch ? `Error ${codeMatch[1]}` : "Gagal menukarkan license";
      }
    }
    showToast(`Gagal menukarkan license: ${errorMessage}`, "error");
  }
}

async function handleChangePassword(event: Event) {
  event.preventDefault();
  
  const email = byId<HTMLInputElement>("change-password-email").value;
  const newPassword = byId<HTMLInputElement>("change-password-new").value;
  
  try {
    const machineId = await invoke<string>("get_machine_id");
    await invoke("change_password", { email, newPassword, machineId });
    
    hideModal("modal-change-password");
    showToast("Password berhasil diubah!", "success");
    
  } catch (error) {
    showToast(`Gagal mengubah password: ${error}`, "error");
  }
}

// ==================== Step 1: Shopee Accounts ====================

async function loadShopeeAccounts() {
  if (!state.currentUser) return;
  
  try {
    const result = await invoke<{ data: ShopeeAccount[] }>("get_shopee_accounts", {
      email: state.currentUser.email,
      password: state.currentPassword,
    });
    
    renderShopeeAccounts(result.data);
    
    // Enable next button if account is selected
    byId<HTMLButtonElement>("btn-step-1-next").disabled = state.selectedAccount === null;
    
  } catch (error) {
    showToast(`Gagal memuat akun: ${error}`, "error");
  }
}

function renderShopeeAccounts(accounts: ShopeeAccount[]) {
  const container = byId("accounts-list");
  container.innerHTML = "";
  
  if (accounts.length === 0) {
    container.innerHTML = '<div class="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-center text-neutral-500">Belum ada akun Shopee</div>';
    return;
  }
  
  accounts.forEach(account => {
    const isSelected = state.selectedAccount?.id === account.id;
    const card = document.createElement("div");
    card.className = `rounded-xl border p-4 shadow-sm cursor-pointer transition-colors ${isSelected ? "border-orange-400 bg-orange-50 ring-2 ring-orange-200" : "border-neutral-200 bg-white hover:bg-neutral-50"}`;
    
    card.innerHTML = `
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3 flex-1">
          <input
            type="radio"
            name="selected-account"
            id="account-${account.id}"
            value="${account.id}"
            ${isSelected ? "checked" : ""}
            class="h-4 w-4 text-orange-600 border-neutral-300 focus:ring-orange-500"
          />
          <label for="account-${account.id}" class="flex-1 cursor-pointer">
            <div class="font-medium text-neutral-800">${account.name}</div>
            <div class="text-xs text-neutral-500">ID: ${account.id}</div>
          </label>
        </div>
        <button class="btn-delete-account rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs text-red-700 hover:bg-red-50" data-id="${account.id}" onclick="event.stopPropagation()">
          Hapus
        </button>
      </div>
    `;
    
    container.appendChild(card);
    
    // Radio button selection
    const radio = card.querySelector(`#account-${account.id}`) as HTMLInputElement;
    radio.addEventListener("change", () => {
      if (radio.checked) {
        state.selectedAccount = account;
        renderShopeeAccounts(accounts); // Re-render to update selection
        // Enable next button
        byId<HTMLButtonElement>("btn-step-1-next").disabled = false;
      }
    });
    
    // Click on card also selects
    card.addEventListener("click", () => {
      radio.checked = true;
      radio.dispatchEvent(new Event("change"));
    });
    
    // Delete
    card.querySelector(".btn-delete-account")?.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!state.currentUser) return;
      if (!confirm(`Yakin ingin menghapus akun "${account.name}"?`)) return;
      
      try {
        await invoke("delete_shopee_account", {
          email: state.currentUser.email,
          password: state.currentPassword,
          accountId: account.id,
        });
        loadShopeeAccounts();
      } catch (error) {
        showToast(`Gagal menghapus akun: ${error}`, "error");
      }
    });
  });
}

// ==================== QR Scan ====================

let qrStatusInterval: number | null = null;

async function generateQR() {
  const preview = byId<HTMLDivElement>("qr-preview");
  const img = byId<HTMLImageElement>("qr-image");
  const loading = byId<HTMLDivElement>("qr-loading");
  const status = byId("qr-status");
  const statusText = byId("qr-status-text");
  const statusMsg = byId("qr-status-message");
  
  preview.classList.remove("hidden");
  loading.classList.remove("hidden");
  img.classList.add("hidden");
  status.classList.add("hidden");
  statusMsg.classList.add("hidden");
  
  try {
    const { qrcode_id, qrcode_base64 } = await invoke<{ qrcode_id: string; qrcode_base64: string }>("generate_shopee_qr");
    
    img.src = `data:image/png;base64,${qrcode_base64}`;
    loading.classList.add("hidden");
    img.classList.remove("hidden");
    status.classList.remove("hidden");
    
    statusText.textContent = "WAITING";
    statusMsg.className = "mb-4 rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-800";
    statusMsg.textContent = "Scan QR dengan aplikasi Shopee Anda.";
    statusMsg.classList.remove("hidden");
    
    // Poll for status
    if (qrStatusInterval) clearInterval(qrStatusInterval);
    
    qrStatusInterval = window.setInterval(async () => {
      try {
        const { status: qrStatus, qrcode_token } = await invoke<{ status: string; qrcode_token?: string }>("check_qr_status", { qrcodeId: qrcode_id });
        statusText.textContent = qrStatus;
        
        if (qrStatus === "CONFIRMED" && qrcode_token) {
          clearInterval(qrStatusInterval!);
          await handleQRConfirmed(qrcode_token);
        } else if (qrStatus === "SUCCESS" && qrcode_token) {
          clearInterval(qrStatusInterval!);
          await handleQRConfirmed(qrcode_token);
        } else if (qrStatus === "EXPIRED" || qrStatus === "CANCELLED") {
          clearInterval(qrStatusInterval!);
          statusMsg.className = "mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800";
          statusMsg.textContent = `❌ QR Code ${qrStatus === "EXPIRED" ? "expired" : "dibatalkan"}. Silakan coba lagi.`;
        }
      } catch (error) {
        console.error("Error checking QR status:", error);
      }
    }, 2000);
    
    setTimeout(() => {
      if (qrStatusInterval) clearInterval(qrStatusInterval);
    }, 300000);
    
  } catch (error) {
    statusMsg.className = "mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800";
    statusMsg.textContent = `❌ Gagal membuat QR: ${error}`;
    statusMsg.classList.remove("hidden");
  }
}

async function handleQRConfirmed(qrcode_token: string) {
  const statusMsg = byId("qr-status-message");
  statusMsg.className = "mb-4 rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-800";
  statusMsg.textContent = "QR Confirmed! Logging in...";
  
  try {
    const loginResult = await invoke<{ success: boolean; cookies?: string; error_msg?: string }>("qr_login", { qrcodeToken: qrcode_token });
    
    if (loginResult.success && loginResult.cookies) {
      statusMsg.textContent = "Login berhasil! Mengambil info akun...";
      
      try {
        const accountInfo = await invoke<{ userid: number; username: string; nickname: string }>("get_account_info", { cookies: loginResult.cookies });
        
        const accountName = accountInfo.nickname 
          ? `${accountInfo.username} / ${accountInfo.nickname}`
          : accountInfo.username;
        
        statusMsg.textContent = `Menyimpan akun "${accountName}"...`;
        
        if (state.currentUser) {
          await invoke<{ success: boolean; data: ShopeeAccount }>("add_shopee_account", {
            email: state.currentUser.email,
            password: state.currentPassword,
            name: accountName,
            cookie: loginResult.cookies,
            isActive: true,
          });
          
          statusMsg.textContent = `✅ Akun "${accountName}" berhasil ditambahkan!`;
          statusMsg.className = "mb-4 rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-800";
          
          hideModal("modal-qr-scan");
          loadShopeeAccounts();
        }
      } catch (error) {
        statusMsg.className = "mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800";
        statusMsg.textContent = `❌ Gagal mengambil informasi akun: ${error}`;
      }
    } else {
      statusMsg.className = "mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800";
      statusMsg.textContent = `❌ Login gagal: ${loginResult.error_msg || "Unknown error"}`;
    }
  } catch (error) {
    statusMsg.className = "mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800";
    statusMsg.textContent = `❌ Error: Gagal memproses login`;
  }
}

async function handleAddAccountManual(event: Event) {
  event.preventDefault();
  
  const name = byId<HTMLInputElement>("manual-account-name").value;
  const cookie = byId<HTMLTextAreaElement>("manual-account-cookie").value;
  
  if (!state.currentUser) return;
  
  try {
    await invoke<{ success: boolean; data: ShopeeAccount }>("add_shopee_account", {
      email: state.currentUser.email,
      password: state.currentPassword,
      name,
      cookie,
      isActive: true,
    });
    
    hideModal("modal-add-account-manual");
    showToast("Akun berhasil ditambahkan!", "success");
    loadShopeeAccounts();
    
  } catch (error) {
    showToast(`Gagal menambahkan akun: ${error}`, "error");
  }
}

// ==================== Step 2: Niche & Product Set ====================

async function loadNiches() {
  if (!state.currentUser) return;
  
  try {
    const result = await invoke<{ niches: Niche[] }>("get_niches", {
      email: state.currentUser.email,
      password: state.currentPassword,
    });
    
    renderNiches(result.niches);
    
    // If we have a selected niche, refresh its detail
    if (state.selectedNiche) {
      const updatedNiche = result.niches.find(n => n.id === state.selectedNiche!.id);
      if (updatedNiche) {
        state.selectedNiche = updatedNiche;
        showNicheDetail(updatedNiche);
      }
    }
    
  } catch (error) {
    showToast(`Gagal memuat niches: ${error}`, "error");
  }
}

function renderNiches(niches: Niche[]) {
  const container = byId("niches-list");
  container.innerHTML = "";
  
  if (niches.length === 0) {
    container.innerHTML = '<div class="text-sm text-neutral-500">Belum ada niche. Klik "+ Buat Niche" untuk membuat.</div>';
    return;
  }
  
  niches.forEach(niche => {
    const isSelected = state.selectedNiche?.id === niche.id;
    const item = document.createElement("div");
    item.className = `rounded-lg border p-3 transition-colors cursor-pointer ${isSelected ? "border-orange-400 bg-orange-50 ring-2 ring-orange-200" : "border-neutral-200 bg-white hover:bg-neutral-50"}`;
    
    const productSetsCount = niche.product_sets?.length || 0;
    
    item.innerHTML = `
      <div class="flex items-start justify-between">
        <div class="flex items-center gap-3 flex-1" data-niche-id="${niche.id}">
          <input
            type="radio"
            name="selected-niche"
            id="niche-${niche.id}"
            value="${niche.id}"
            ${isSelected ? "checked" : ""}
            class="h-4 w-4 text-orange-600 border-neutral-300 focus:ring-orange-500"
          />
          <label for="niche-${niche.id}" class="flex-1 cursor-pointer">
            <div class="font-medium text-neutral-800">${niche.name}</div>
            ${niche.description ? `<div class="text-xs text-neutral-500 mt-1">${niche.description}</div>` : ""}
            <div class="text-xs text-neutral-400 mt-1">${productSetsCount} product set${productSetsCount !== 1 ? 's' : ''} • Klik untuk detail</div>
          </label>
        </div>
        <div class="flex gap-1 ml-2">
          <button class="btn-edit-niche rounded-lg border border-neutral-300 bg-white px-2 py-1 text-xs hover:bg-neutral-50" data-id="${niche.id}" title="Edit">
            ✏️
          </button>
          <button class="btn-delete-niche rounded-lg border border-red-300 bg-white px-2 py-1 text-xs text-red-700 hover:bg-red-50" data-id="${niche.id}" title="Hapus">
            🗑️
          </button>
        </div>
      </div>
    `;
    
    container.appendChild(item);
    
    // Radio button selection
    const radio = item.querySelector(`#niche-${niche.id}`) as HTMLInputElement;
    radio.addEventListener("change", () => {
      if (radio.checked) {
        state.selectedNiche = niche;
        showNicheDetail(niche);
        renderNiches(niches); // Re-render to update selection
        updateStep2NextButton();
      }
    });
    
    // Click on card also selects and shows detail
    item.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.btn-edit-niche') && !target.closest('.btn-delete-niche')) {
        radio.checked = true;
        radio.dispatchEvent(new Event("change"));
      }
    });
    
    // Edit button
    const editBtn = item.querySelector(`.btn-edit-niche[data-id="${niche.id}"]`) as HTMLButtonElement;
    if (editBtn) {
      editBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
    e.preventDefault();
        openEditNicheModal(niche);
      });
    }
    
    // Delete button - use direct reference
    const deleteBtn = item.querySelector(`.btn-delete-niche[data-id="${niche.id}"]`) as HTMLButtonElement;
    if (deleteBtn) {
      deleteBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        e.preventDefault();
        console.log("Delete niche clicked:", niche.id, niche.name);
        
        const confirmed = await confirmDialog(`Yakin ingin menghapus niche "${niche.name}"?`);
        console.log("Confirm result:", confirmed);
        
        if (!confirmed) {
          console.log("User cancelled delete niche");
          return;
        }
        
        if (!state.currentUser) {
          console.error("No current user");
          return;
        }
        
        console.log("Current user:", state.currentUser.email);
        console.log("Deleting niche:", niche.id);
        
        try {
          const result = await invoke("delete_niche", {
            email: state.currentUser.email,
            password: state.currentPassword,
            nicheId: niche.id,
          });
          console.log("Niche deleted successfully, result:", result);
          showToast("Niche berhasil dihapus", "success");
          
          // Reset selected niche and close detail panel if deleted niche was selected
          if (state.selectedNiche?.id === niche.id) {
            state.selectedNiche = null;
            state.selectedProductSets = [];
            byId("niche-detail-panel").classList.add("hidden");
            byId("product-set-detail-panel").classList.add("hidden");
            updateStep2NextButton();
          }
          
          // Reload niches to refresh the list
          await loadNiches();
        } catch (error) {
          console.error("Error deleting niche:", error);
          showToast(`Gagal menghapus niche: ${error}`, "error");
        }
      });
    } else {
      console.error("Delete button not found for niche:", niche.id);
    }
  });
}

function showNicheDetail(niche: Niche) {
  state.selectedNiche = niche;
  byId("selected-niche-name").textContent = niche.name;
  byId("niche-detail-panel").classList.remove("hidden");
  
  loadProductSetsForNiche(niche.id);
}

async function loadProductSetsForNiche(nicheId: number) {
  if (!state.currentUser) return;
  
  try {
    const result = await invoke<{ product_sets: ProductSet[] }>("get_product_sets", {
      email: state.currentUser.email,
      password: state.currentPassword,
    });
    
    const nicheProductSets = result.product_sets.filter(ps => ps.niche_id === nicheId);
    state.selectedProductSets = nicheProductSets;
    
    renderProductSets(nicheProductSets);
    
  } catch (error) {
    showToast(`Gagal memuat product sets: ${error}`, "error");
  }
}

function renderProductSets(productSets: ProductSet[]) {
  const container = byId("product-sets-list");
  container.innerHTML = "";
  
  if (productSets.length === 0) {
    container.innerHTML = '<div class="text-sm text-neutral-500">Belum ada product set. Klik "+ Buat Product Set" untuk membuat.</div>';
    return;
  }
  
  productSets.forEach(ps => {
    const item = document.createElement("div");
    item.className = "rounded-lg border border-neutral-200 bg-white p-3";
    
    item.innerHTML = `
      <div class="flex items-start justify-between">
        <div class="flex-1 cursor-pointer" data-product-set-id="${ps.id}">
          <div class="font-medium text-neutral-800">${ps.name}</div>
          ${ps.description ? `<div class="text-xs text-neutral-500 mt-1">${ps.description}</div>` : ""}
          <div class="text-xs text-neutral-400 mt-1">${ps.items.length} item${ps.items.length !== 1 ? 's' : ''}</div>
        </div>
        <div class="flex gap-1 ml-2">
          <button class="btn-view-product-set rounded-lg border border-orange-300 bg-white px-2 py-1 text-xs text-orange-600 hover:bg-orange-50" data-id="${ps.id}" title="Lihat Items">
            👁️
          </button>
          <button class="btn-edit-product-set rounded-lg border border-neutral-300 bg-white px-2 py-1 text-xs hover:bg-neutral-50" data-id="${ps.id}" title="Edit">
            ✏️
          </button>
          <button class="btn-delete-product-set rounded-lg border border-red-300 bg-white px-2 py-1 text-xs text-red-700 hover:bg-red-50" data-id="${ps.id}" title="Hapus">
            🗑️
          </button>
        </div>
      </div>
    `;
    
    // View items button
    const viewBtn = item.querySelector(`.btn-view-product-set[data-id="${ps.id}"]`) as HTMLButtonElement;
    if (viewBtn) {
      viewBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();
        showProductSetDetail(ps);
      });
    }
    
    // Edit button
    const editBtn = item.querySelector(`.btn-edit-product-set[data-id="${ps.id}"]`) as HTMLButtonElement;
    if (editBtn) {
      editBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();
        openEditProductSetModal(ps);
      });
    }
    
    // Delete button - use direct reference
    const deleteBtn = item.querySelector(`.btn-delete-product-set[data-id="${ps.id}"]`) as HTMLButtonElement;
    if (deleteBtn) {
      deleteBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        e.preventDefault();
        console.log("Delete product set clicked:", ps.id, ps.name);
        
        const confirmed = await confirmDialog(`Yakin ingin menghapus product set "${ps.name}"?`);
        console.log("Confirm result:", confirmed);
        
        if (!confirmed) {
          console.log("User cancelled delete product set");
          return;
        }
        
        if (!state.currentUser) {
          console.error("No current user");
          return;
        }
        
        console.log("Current user:", state.currentUser.email);
        console.log("Deleting product set:", ps.id);
        
        try {
          const result = await invoke("delete_product_set", {
            email: state.currentUser.email,
            password: state.currentPassword,
            productSetId: ps.id,
          });
          console.log("Product set deleted successfully, result:", result);
          showToast("Product set berhasil dihapus", "success");
          // Reload product sets for selected niche and refresh niche list to update counts
          if (state.selectedNiche) {
            await loadProductSetsForNiche(state.selectedNiche.id);
            // Also reload niches to update the product sets count
            await loadNiches();
          } else {
            await loadNiches();
          }
        } catch (error) {
          console.error("Error deleting product set:", error);
          showToast(`Gagal menghapus product set: ${error}`, "error");
        }
      });
    } else {
      console.error("Delete button not found for product set:", ps.id);
    }
    
    container.appendChild(item);
  });
}

function updateStep2NextButton() {
  const hasNiche = state.selectedNiche !== null;
  byId<HTMLButtonElement>("btn-step-2-next").disabled = !hasNiche;
}

// ==================== Niche CRUD ====================

function openCreateNicheModal() {
  byId<HTMLInputElement>("niche-id").value = "";
  byId<HTMLInputElement>("niche-name").value = "";
  byId<HTMLTextAreaElement>("niche-description").value = "";
  byId("modal-niche-title").textContent = "Buat Niche";
  showModal("modal-niche");
}

function openEditNicheModal(niche: Niche) {
  byId<HTMLInputElement>("niche-id").value = niche.id.toString();
  byId<HTMLInputElement>("niche-name").value = niche.name;
  byId<HTMLTextAreaElement>("niche-description").value = niche.description || "";
  byId("modal-niche-title").textContent = "Edit Niche";
  showModal("modal-niche");
}

async function handleNicheForm(event: Event) {
  event.preventDefault();
  
  if (!state.currentUser) return;
  
  const id = byId<HTMLInputElement>("niche-id").value;
  const name = byId<HTMLInputElement>("niche-name").value;
  const description = byId<HTMLTextAreaElement>("niche-description").value;
  
  try {
    if (id) {
      // Update
      await invoke("update_niche", {
        email: state.currentUser.email,
        password: state.currentPassword,
        nicheId: parseInt(id),
        name,
        description: description || undefined,
      });
      showToast("Niche berhasil diupdate", "success");
    } else {
      // Create
      await invoke("create_niche", {
        email: state.currentUser.email,
        password: state.currentPassword,
        name,
        description: description || undefined,
      });
      showToast("Niche berhasil dibuat", "success");
    }
    
    hideModal("modal-niche");
    const result = await invoke<{ niches: Niche[] }>("get_niches", {
      email: state.currentUser.email,
      password: state.currentPassword,
    });
    await loadNiches();
    
    // If we just created/updated the selected niche, refresh its detail
    if (state.selectedNiche) {
      const updatedNiche = result.niches.find(n => n.id === (id ? parseInt(id) : state.selectedNiche?.id));
      if (updatedNiche) {
        state.selectedNiche = updatedNiche;
        showNicheDetail(updatedNiche);
      }
    }
  } catch (error) {
    showToast(`Gagal menyimpan niche: ${error}`, "error");
  }
}

// ==================== Product Set CRUD ====================

function openCreateProductSetModal() {
  if (!state.selectedNiche) {
    showToast("Pilih niche terlebih dahulu", "error");
    return;
  }
  
  byId<HTMLInputElement>("product-set-id").value = "";
  byId<HTMLInputElement>("product-set-name").value = "";
  byId<HTMLTextAreaElement>("product-set-description").value = "";
  byId<HTMLTextAreaElement>("product-set-urls").value = "";
  byId<HTMLSelectElement>("product-set-niche-id").value = state.selectedNiche.id.toString();
  byId("modal-product-set-title").textContent = "Buat Product Set";
  byId("product-set-urls-count").textContent = "0 URL terdeteksi";
  byId("product-set-urls-count").className = "mt-1 text-xs text-neutral-400";
  byId("product-set-invalid-urls").innerHTML = "";
  byId("product-set-invalid-urls").classList.add("hidden");
  
  // Show niche dropdown for create
  const nicheSelectDiv = byId<HTMLSelectElement>("product-set-niche-id").parentElement;
  if (nicheSelectDiv) {
    nicheSelectDiv.classList.remove("hidden");
  }
  
  // Populate niche dropdown
  populateNicheDropdown();
  
  showModal("modal-product-set");
  
  // Add URL count listener (remove old one first to avoid duplicates)
  const urlsTextarea = byId<HTMLTextAreaElement>("product-set-urls");
  urlsTextarea.removeEventListener("input", updateUrlCount);
  urlsTextarea.addEventListener("input", updateUrlCount);
}

function openEditProductSetModal(productSet: ProductSet) {
  byId<HTMLInputElement>("product-set-id").value = productSet.id.toString();
  byId<HTMLInputElement>("product-set-name").value = productSet.name;
  byId<HTMLTextAreaElement>("product-set-description").value = productSet.description || "";
  // Populate URLs from items
  const urls = productSet.items.map(item => item.url).join("\n");
  byId<HTMLTextAreaElement>("product-set-urls").value = urls;
  
  // Hide niche dropdown for edit (niche already selected)
  const nicheSelectDiv = byId<HTMLSelectElement>("product-set-niche-id").parentElement;
  if (nicheSelectDiv) {
    nicheSelectDiv.classList.add("hidden");
  }
  
  byId("modal-product-set-title").textContent = "Edit Product Set";
  
  // Reset invalid URLs display
  byId("product-set-invalid-urls").innerHTML = "";
  byId("product-set-invalid-urls").classList.add("hidden");
  
  updateUrlCount(); // Update count display
  
  showModal("modal-product-set");
  
  // Add URL count listener (remove old one first to avoid duplicates)
  const urlsTextarea = byId<HTMLTextAreaElement>("product-set-urls");
  urlsTextarea.removeEventListener("input", updateUrlCount);
  urlsTextarea.addEventListener("input", updateUrlCount);
}

function validateShopeeUrl(url: string): boolean {
  // Format: https://shopee.co.id/product/{shop_id}/{item_id}
  const pattern = /^https?:\/\/shopee\.co\.id\/product\/\d+\/\d+/i;
  return pattern.test(url.trim());
}

function updateUrlCount() {
  const urlsText = byId<HTMLTextAreaElement>("product-set-urls").value;
  const lines = urlsText.split("\n");
  const urls = lines.map(url => url.trim()).filter(url => url.length > 0);
  const invalidUrls = urls.filter(url => !validateShopeeUrl(url));
  const count = urls.length;
  
  let countText = `${count} URL terdeteksi`;
  if (invalidUrls.length > 0) {
    countText += ` (${invalidUrls.length} tidak valid)`;
  }
  if (count > 100) {
    countText += " • Maks 100";
  }
  
  byId("product-set-urls-count").textContent = countText;
  
  // Update styling based on validation
  if (invalidUrls.length > 0 || count > 100) {
    byId("product-set-urls-count").classList.add("text-red-600");
    byId("product-set-urls-count").classList.remove("text-neutral-400");
    byId("product-set-urls-count").classList.remove("text-green-600");
  } else if (count > 0) {
    byId("product-set-urls-count").classList.remove("text-red-600");
    byId("product-set-urls-count").classList.remove("text-neutral-400");
    byId("product-set-urls-count").classList.add("text-green-600");
  } else {
    byId("product-set-urls-count").classList.remove("text-red-600");
    byId("product-set-urls-count").classList.remove("text-green-600");
    byId("product-set-urls-count").classList.add("text-neutral-400");
  }
  
  // Show invalid URLs if any
  const invalidUrlsDiv = byId("product-set-invalid-urls");
  if (invalidUrls.length > 0) {
    invalidUrlsDiv.innerHTML = `
      <div class="mt-2 rounded-lg border border-red-200 bg-red-50 p-3">
        <div class="mb-1 text-xs font-medium text-red-800">URL tidak valid:</div>
        <div class="space-y-1 text-xs text-red-700">
          ${invalidUrls.map(url => `<div class="font-mono">${url.substring(0, 80)}${url.length > 80 ? '...' : ''}</div>`).join('')}
        </div>
      </div>
    `;
    invalidUrlsDiv.classList.remove("hidden");
  } else {
    invalidUrlsDiv.classList.add("hidden");
  }
}

async function populateNicheDropdown() {
  if (!state.currentUser) return;
  
  const select = byId<HTMLSelectElement>("product-set-niche-id");
  const currentValue = select.value;
  
  try {
    const result = await invoke<{ niches: Niche[] }>("get_niches", {
      email: state.currentUser.email,
      password: state.currentPassword,
    });
    
    select.innerHTML = '<option value="">Tidak ada niche</option>';
    result.niches.forEach(niche => {
      const option = document.createElement("option");
      option.value = niche.id.toString();
      option.textContent = niche.name;
      select.appendChild(option);
    });
    
    select.value = currentValue;
  } catch (error) {
    console.error("Failed to load niches:", error);
  }
}

async function handleProductSetForm(event: Event) {
  event.preventDefault();
  
  if (!state.currentUser) return;
  
  const id = byId<HTMLInputElement>("product-set-id").value;
  const name = byId<HTMLInputElement>("product-set-name").value;
  const description = byId<HTMLTextAreaElement>("product-set-description").value;
  const urlsText = byId<HTMLTextAreaElement>("product-set-urls").value;
  
  // For edit: niche is already selected, don't allow changing it
  // For create: get from dropdown (but it should be pre-filled with selected niche)
  let nicheId: number | undefined;
  const nicheSelectDiv = byId<HTMLSelectElement>("product-set-niche-id").parentElement;
  if (nicheSelectDiv && !nicheSelectDiv.classList.contains("hidden")) {
    const nicheIdStr = byId<HTMLSelectElement>("product-set-niche-id").value;
    nicheId = nicheIdStr ? parseInt(nicheIdStr) : undefined;
  } else {
    // Edit mode: use existing niche_id from product set or selected niche
    if (id && state.selectedNiche) {
      nicheId = state.selectedNiche.id;
    }
  }
  
  // Parse URLs
  const urls = urlsText.split("\n").map(url => url.trim()).filter(url => url.length > 0);
  
  // Validate URLs
  const invalidUrls = urls.filter(url => !validateShopeeUrl(url));
  if (invalidUrls.length > 0) {
    showToast(`${invalidUrls.length} URL tidak valid. Format harus: https://shopee.co.id/product/{shop_id}/{item_id}`, "error");
    return;
  }
  
  if (urls.length > 100) {
    showToast("Maksimal 100 items per product set", "error");
    return;
  }
  
  if (urls.length === 0) {
    showToast("Masukkan minimal satu URL yang valid", "error");
    return;
  }
  
  try {
    let productSetId: number;
    
    if (id) {
      // Update product set
      productSetId = parseInt(id);
      await invoke("update_product_set", {
        email: state.currentUser.email,
        password: state.currentPassword,
        productSetId,
        name,
        description: description || undefined,
        nicheId,
      });
      
      // Clear existing items and add new ones
      if (urls.length > 0) {
        try {
          await invoke("clear_product_set_items", {
            email: state.currentUser.email,
            password: state.currentPassword,
            productSetId,
          });
        } catch (clearError) {
          // Ignore clear errors, might not have items
        }
        
        const items = urls.map(url => ({ url }));
        await invoke("add_product_set_items", {
          email: state.currentUser.email,
          password: state.currentPassword,
          productSetId,
          items,
        });
      }
      
      showToast("Product set berhasil diupdate", "success");
    } else {
      // Create product set
      const result = await invoke<ProductSet>("create_product_set", {
        email: state.currentUser.email,
        password: state.currentPassword,
        name,
        description: description || undefined,
        nicheId,
      });
      
      productSetId = result.id;
      
      // Add items if URLs provided
      if (urls.length > 0) {
        const items = urls.map(url => ({ url }));
        await invoke("add_product_set_items", {
          email: state.currentUser.email,
          password: state.currentPassword,
          productSetId,
          items,
        });
      }
      
      showToast(`Product set berhasil dibuat dengan ${urls.length} item(s)`, "success");
    }
    
    hideModal("modal-product-set");
    
    // Reload product sets for selected niche and refresh niche list to update counts
    if (state.selectedNiche) {
      await loadProductSetsForNiche(state.selectedNiche.id);
      // Also reload niches to update the product sets count
      await loadNiches();
    } else {
      await loadNiches();
    }
  } catch (error) {
    showToast(`Gagal menyimpan product set: ${error}`, "error");
  }
}

// ==================== Product Set Items ====================

let currentProductSetForItems: ProductSet | null = null;

function showProductSetDetail(productSet: ProductSet) {
  currentProductSetForItems = productSet;
  byId("selected-product-set-name").textContent = productSet.name;
  byId("product-set-detail-panel").classList.remove("hidden");
  
  renderProductSetItems(productSet.items);
}

function renderProductSetItems(items: ProductSetItem[]) {
  const container = byId("product-set-items-list");
  container.innerHTML = "";
  
  if (items.length === 0) {
    container.innerHTML = '<div class="text-sm text-neutral-500">Belum ada items. Klik "+ Tambah Items" untuk menambahkan.</div>';
    return;
  }
  
  items.forEach(item => {
    const itemEl = document.createElement("div");
    itemEl.className = "rounded-lg border border-neutral-200 bg-white p-3";
    
    itemEl.innerHTML = `
      <div class="flex items-start justify-between">
        <div class="flex-1">
          <a href="${item.url}" target="_blank" class="text-sm text-blue-600 hover:underline break-all">${item.url}</a>
          ${item.shop_id && item.item_id ? `<div class="text-xs text-neutral-500 mt-1">Shop: ${item.shop_id}, Item: ${item.item_id}</div>` : ""}
        </div>
        <button class="btn-delete-item rounded-lg border border-red-300 bg-white px-2 py-1 text-xs text-red-700 hover:bg-red-50 ml-2" data-item-id="${item.id}" title="Hapus">
          🗑️
        </button>
      </div>
    `;
    
    // Delete button - use direct reference
    const deleteBtn = itemEl.querySelector(`.btn-delete-item[data-item-id="${item.id}"]`) as HTMLButtonElement;
    if (deleteBtn) {
      deleteBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        e.preventDefault();
        console.log("Delete item clicked:", item.id, item.url);
        
        const confirmed = await confirmDialog("Yakin ingin menghapus item ini?");
        console.log("Confirm result:", confirmed);
        
        if (!confirmed) {
          console.log("User cancelled delete item");
          return;
        }
        
        if (!state.currentUser || !currentProductSetForItems) {
          console.error("No current user or product set", {
            hasUser: !!state.currentUser,
            hasProductSet: !!currentProductSetForItems
          });
          return;
        }
        
        console.log("Current user:", state.currentUser.email);
        console.log("Product set:", currentProductSetForItems.id);
        console.log("Deleting item:", item.id, "from product set:", currentProductSetForItems.id);
        
        try {
          const result = await invoke("delete_product_set_item", {
            email: state.currentUser.email,
            password: state.currentPassword,
            productSetId: currentProductSetForItems.id,
            itemId: item.id,
          });
          console.log("Item deleted successfully, result:", result);
          showToast("Item berhasil dihapus", "success");
          
          // Reload product set detail
          if (state.selectedNiche) {
            loadProductSetsForNiche(state.selectedNiche.id).then(() => {
              // Find updated product set
              const updated = state.selectedProductSets.find(ps => ps.id === currentProductSetForItems!.id);
              if (updated) {
                showProductSetDetail(updated);
              }
            });
          }
        } catch (error) {
          console.error("Error deleting item:", error);
          showToast(`Gagal menghapus item: ${error}`, "error");
        }
      });
    } else {
      console.error("Delete button not found for item:", item.id);
    }
    
    container.appendChild(itemEl);
  });
}

function openAddItemsModal(productSet: ProductSet) {
  currentProductSetForItems = productSet;
  byId<HTMLInputElement>("add-items-product-set-id").value = productSet.id.toString();
  byId<HTMLTextAreaElement>("items-urls").value = "";
  showModal("modal-add-items");
}

async function handleAddItemsForm(event: Event) {
  event.preventDefault();
  
  if (!state.currentUser || !currentProductSetForItems) return;
  
  const urlsText = byId<HTMLTextAreaElement>("items-urls").value;
  const urls = urlsText.split("\n").map(url => url.trim()).filter(url => url.length > 0);
  
  if (urls.length === 0) {
    showToast("Masukkan minimal satu URL", "error");
    return;
  }
  
  if (urls.length > 100) {
    showToast("Maksimal 100 items per product set", "error");
    return;
  }
  
  try {
    const items = urls.map(url => ({ url }));
    
    await invoke("add_product_set_items", {
      email: state.currentUser.email,
      password: state.currentPassword,
      productSetId: currentProductSetForItems.id,
      items,
    });
    
    showToast(`${urls.length} item(s) berhasil ditambahkan`, "success");
    hideModal("modal-add-items");
    
    // Reload product set detail
    if (state.selectedNiche) {
      loadProductSetsForNiche(state.selectedNiche.id).then(() => {
        const updated = state.selectedProductSets.find(ps => ps.id === currentProductSetForItems!.id);
        if (updated) {
          showProductSetDetail(updated);
        }
      });
    }
  } catch (error) {
    showToast(`Gagal menambahkan items: ${error}`, "error");
  }
}

// ==================== Step 3: Run Bot ====================

function renderProductSetsRotation() {
  const container = byId("product-sets-tabs");
  container.innerHTML = "";
  
  if (state.selectedProductSets.length === 0) {
    container.innerHTML = '<div class="text-sm text-neutral-500">Belum ada product set yang dipilih</div>';
    return;
  }
  
  state.selectedProductSets.forEach((productSet, index) => {
    const isActive = index === state.currentProductSetIndex && state.isBotRunning;
    const isNext = index === (state.currentProductSetIndex + 1) % state.selectedProductSets.length && state.isBotRunning;
    
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive 
        ? "bg-green-500 text-white shadow-md" 
        : isNext
        ? "bg-blue-100 text-blue-800 border-2 border-blue-300"
        : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 border border-neutral-300"
    }`;
    tab.textContent = `${index + 1}. ${productSet.name}`;
    tab.dataset.setIndex = index.toString();
    
    if (!state.isBotRunning || !isActive) {
      tab.addEventListener("click", () => {
        switchToProductSet(index);
      });
      tab.classList.add("cursor-pointer");
    } else {
      tab.classList.add("cursor-default");
    }
    
    if (isActive) {
      tab.innerHTML = `<span class="inline-block mr-2">✓</span>${tab.textContent}`;
    }
    
    container.appendChild(tab);
  });
  
  // Update rotation status
  if (state.isBotRunning && state.selectedProductSets.length > 0) {
    const current = state.selectedProductSets[state.currentProductSetIndex];
    const nextIndex = (state.currentProductSetIndex + 1) % state.selectedProductSets.length;
    const next = state.selectedProductSets[nextIndex];
    byId("rotation-status").textContent = `Aktif: "${current.name}" → Selanjutnya: "${next.name}"`;
  } else {
    byId("rotation-status").textContent = "Siap";
  }
}

async function switchToProductSet(index: number) {
  if (!state.isBotRunning || !state.currentUser || !state.selectedAccount) {
    // If bot not running, just update the index for when it starts
    state.currentProductSetIndex = index;
    renderProductSetsRotation();
    return;
  }
  
  if (index < 0 || index >= state.selectedProductSets.length) {
    return;
  }
  
  const productSet = state.selectedProductSets[index];
  state.currentProductSetIndex = index;
  
  // Immediately replace products with the selected set
  try {
    if (!state.sessionId) {
      showToast("Tidak ada session aktif", "error");
      // Try to refresh session
      await checkSessions();
      if (!state.sessionId) {
        return;
      }
    }
    
    // Use the single session ID
    await invoke("replace_products", {
      email: state.currentUser.email,
      password: state.currentPassword,
      shopeeAccountId: state.selectedAccount.id,
      sessionId: state.sessionId,
      productSetId: productSet.id,
    });
    
    showToast(`Switched ke product set "${productSet.name}"`, "success");
    byId("bot-status-text").textContent = "Berjalan";
    byId("bot-last-action").textContent = `Set "${productSet.name}" diaktifkan`;
    
    // Update visualization
    renderProductSetsRotation();
    
    // Continue rotation from this point (next iteration will be index + 1)
    // The botLoop will continue from here
    
  } catch (error) {
    showToast(`Gagal switch ke product set: ${error}`, "error");
  }
}

async function checkSessions() {
  console.log("checkSessions() called", {
    hasUser: !!state.currentUser,
    hasAccount: !!state.selectedAccount,
    accountId: state.selectedAccount?.id,
    accountName: state.selectedAccount?.name
  });
  
  if (!state.currentUser || !state.selectedAccount) {
    console.warn("Cannot check sessions: missing user or account", {
      user: state.currentUser?.email,
      account: state.selectedAccount
    });
    byId("bot-status-text").textContent = "Error: Akun belum dipilih";
    byId("rotation-status").textContent = "Akun belum dipilih";
    return;
  }
  
  // Show loading state
  const startBotBtn = byId<HTMLButtonElement>("btn-start-bot");
  const warningDiv = byId("bot-session-warning");
  const sessionIdsDiv = byId("bot-session-ids");
  const rotationStatus = byId("rotation-status");
  
  startBotBtn.disabled = true;
  byId("bot-status-text").textContent = "Memeriksa session...";
  rotationStatus.textContent = "Memeriksa...";
  sessionIdsDiv.classList.add("hidden");
  warningDiv.classList.add("hidden");
  
  try {
    console.log("Fetching session IDs for account:", state.selectedAccount.id);
    
    // Validate all required parameters
    if (!state.currentPassword) {
      throw new Error("Password tidak tersedia. Silakan login ulang.");
    }
    
    const requestParams = {
      email: state.currentUser.email,
      password: state.currentPassword,
      shopeeAccountId: state.selectedAccount.id,
    };
    
    console.log("Request parameters:", {
      email: requestParams.email,
      hasPassword: !!requestParams.password,
      shopeeAccountId: requestParams.shopeeAccountId
    });
    
    console.log("Calling invoke('get_session_ids', ...)");
    const sessionResult = await invoke<{ session_ids: string[] }>("get_session_ids", requestParams);
    
    console.log("Session result received:", sessionResult);
    
    // API returns array, but we only expect one session ID (or empty array)
    const sessionIds = sessionResult.session_ids || [];
    state.sessionId = sessionIds.length > 0 ? sessionIds[0] : null;
    
    console.log("Session ID:", state.sessionId);
    
    if (!state.sessionId) {
      // No session - show warning and disable button
      warningDiv.classList.remove("hidden");
      sessionIdsDiv.classList.add("hidden");
      startBotBtn.disabled = true;
      byId("bot-status-text").textContent = "Tidak ada session aktif";
      rotationStatus.textContent = "Tidak ada session";
      showToast("Belum ada session aktif. Pastikan live stream sedang berjalan.", "info");
    } else {
      // Has session - show session ID and enable button
      warningDiv.classList.add("hidden");
      sessionIdsDiv.classList.remove("hidden");
      startBotBtn.disabled = false;
      byId("bot-status-text").textContent = "Siap";
      rotationStatus.textContent = "Session aktif";
      
      // Display session ID
      byId("bot-session-ids-list").innerHTML = `<div class="font-mono text-sm">Session ID: ${state.sessionId}</div>`;
      
      showToast("Session aktif ditemukan", "success");
    }
  } catch (error) {
    console.error("Error checking sessions:", error);
    showToast(`Gagal memuat session: ${error}`, "error");
    
    // On error, disable button and show warning
    startBotBtn.disabled = true;
    warningDiv.classList.remove("hidden");
    sessionIdsDiv.classList.add("hidden");
    byId("bot-status-text").textContent = "Error memuat session";
    rotationStatus.textContent = "Error";
  }
}

// Countdown timer state
let delayCountdownInterval: number | null = null;

function startDelayCountdown(seconds: number, nextSetName: string) {
  // Clear any existing countdown
  if (delayCountdownInterval !== null) {
    clearInterval(delayCountdownInterval);
  }
  
  const countdownEl = byId("delay-countdown");
  const nextSetEl = byId("delay-next-set");
  
  countdownEl.classList.remove("hidden");
  nextSetEl.textContent = nextSetName;
  
  let remaining = seconds;
  updateDelayTimer(remaining);
  
  delayCountdownInterval = window.setInterval(() => {
    remaining--;
    updateDelayTimer(remaining);
    
    if (remaining <= 0) {
      clearInterval(delayCountdownInterval!);
      delayCountdownInterval = null;
      countdownEl.classList.add("hidden");
    }
  }, 1000);
}

function stopDelayCountdown() {
  if (delayCountdownInterval !== null) {
    clearInterval(delayCountdownInterval);
    delayCountdownInterval = null;
  }
  byId("delay-countdown").classList.add("hidden");
}

function updateDelayTimer(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  byId("delay-countdown-timer").textContent = `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function startErrorCountdown() {
  const countdownEl = byId("error-countdown");
  const timerEl = byId("countdown-timer");
  countdownEl.classList.remove("hidden");
  
  let countdown = 10;
  timerEl.textContent = countdown.toString();
  
  const interval = setInterval(() => {
    countdown--;
    timerEl.textContent = countdown.toString();
    
    if (countdown <= 0) {
      clearInterval(interval);
      // Exit app - in Tauri you might want to close window
      showToast("Aplikasi akan ditutup...", "error");
    }
  }, 1000);
}

async function startBot() {
  if (!state.currentUser || !state.selectedAccount || !state.selectedNiche) return;
  
  // Ensure product sets are loaded with items
  if (state.selectedProductSets.length === 0) {
    showToast("Memuat product sets...", "info");
    await loadProductSetsForNiche(state.selectedNiche.id);
  }
  
  // Filter out product sets with no items
  const productSetsWithItems = state.selectedProductSets.filter(ps => ps.items && ps.items.length > 0);
  
  if (productSetsWithItems.length === 0) {
    showToast("Tidak ada product set dengan items. Pastikan product set memiliki produk.", "error");
    return;
  }
  
  // Update selected product sets to only include those with items
  state.selectedProductSets = productSetsWithItems;
  
  // Check if we have a session (re-check before starting)
  if (!state.sessionId) {
    showToast("Tidak ada session aktif. Pastikan akun Shopee memiliki live stream aktif.", "error");
    await checkSessions();
    if (!state.sessionId) {
      // Still no session after refresh
      return;
    }
  }
  
  state.isBotRunning = true;
  state.errorCount = 0;
  byId("btn-start-bot").classList.add("hidden");
  byId("btn-stop-bot").classList.remove("hidden");
  
  // Get initial delay from input
  state.delay = parseInt(byId<HTMLInputElement>("delay-input").value) || 60;
  
  // Reset rotation to start
  state.currentProductSetIndex = 0;
  renderProductSetsRotation();
  
  // Update bot info
  const botAccountName = document.getElementById("bot-account-name");
  if (botAccountName) botAccountName.textContent = state.selectedAccount.name;
  const botNicheName = document.getElementById("bot-niche-name");
  if (botNicheName) botNicheName.textContent = state.selectedNiche.name;
  const botProductSetsCount = document.getElementById("bot-product-sets-count");
  if (botProductSetsCount) botProductSetsCount.textContent = state.selectedProductSets.length.toString();
  
  async function botLoop() {
    if (!state.isBotRunning || !state.currentUser || !state.selectedAccount) return;
    
    // Get current delay dynamically from input (can be changed during run)
    const delayInput = byId<HTMLInputElement>("delay-input");
    const currentDelay = parseInt(delayInput.value) || 60;
    state.delay = currentDelay; // Update state for consistency
    const delayMs = currentDelay * 1000;
    
    try {
      // Check for active session before each cycle
      const sessionResult = await invoke<{ session_ids: string[] }>("get_session_ids", {
        email: state.currentUser.email,
        password: state.currentPassword,
        shopeeAccountId: state.selectedAccount.id,
      });
      
      // Get single session ID (or null)
      const sessionIds = sessionResult.session_ids || [];
      const sessionId = sessionIds.length > 0 ? sessionIds[0] : null;
      state.sessionId = sessionId;
      
      // Update UI with session status
      if (sessionId) {
        byId("bot-session-ids").classList.remove("hidden");
        byId("bot-session-ids-list").innerHTML = `<div class="font-mono text-sm">Session ID: ${sessionId}</div>`;
      } else {
        byId("bot-session-ids").classList.add("hidden");
      }
      
      // If no session, wait and try again (keep looping until session is found)
      if (!sessionId) {
        byId("bot-status-text").textContent = "Menunggu session aktif...";
        byId("bot-last-action").textContent = "Session tidak ditemukan. Bot akan terus memeriksa...";
        startDelayCountdown(currentDelay, "Memeriksa session...");
        await new Promise(resolve => setTimeout(resolve, delayMs));
        stopDelayCountdown();
        if (state.isBotRunning) {
          botLoop();
        }
        return;
      }
      
      if (state.selectedProductSets.length === 0) {
        byId("bot-status-text").textContent = "Tidak ada product set";
        startDelayCountdown(currentDelay, "Memuat product sets...");
        await new Promise(resolve => setTimeout(resolve, delayMs));
        stopDelayCountdown();
        if (state.isBotRunning) {
          botLoop();
        }
        return;
      }
      
      // Get current product set based on rotation index
      const productSet = state.selectedProductSets[state.currentProductSetIndex];
      
      // Use the single session ID to replace products
      try {
        await invoke("replace_products", {
          email: state.currentUser!.email,
          password: state.currentPassword,
          shopeeAccountId: state.selectedAccount!.id,
          sessionId: sessionId,
          productSetId: productSet.id,
        });
        
        state.errorCount = 0; // Reset on success
        
        byId("bot-status-text").textContent = "Berjalan";
        byId("bot-last-action").textContent = `Set "${productSet.name}" → Session ${sessionId.substring(0, 8)}...`;
        
        // Update rotation visualization
        renderProductSetsRotation();
        
        // Move to next product set for next cycle
        state.currentProductSetIndex = (state.currentProductSetIndex + 1) % state.selectedProductSets.length;
        
        // Get next product set name for countdown display
        const nextIndex = state.currentProductSetIndex;
        const nextProductSet = state.selectedProductSets[nextIndex];
        const nextSetName = nextProductSet ? nextProductSet.name : "Tidak ada";
        
        // Wait before next cycle with countdown
        if (state.isBotRunning) {
          startDelayCountdown(currentDelay, nextSetName);
          await new Promise(resolve => setTimeout(resolve, delayMs));
          stopDelayCountdown();
          if (state.isBotRunning) {
            botLoop();
          }
        }
        
      } catch (error) {
        state.errorCount++;
        
        // Check if error is 400 or 422
        const errorStr = String(error);
        if (errorStr.includes("400") || errorStr.includes("422")) {
          if (state.errorCount >= 3) {
            state.isBotRunning = false;
            startErrorCountdown();
            return;
          }
        }
        
        // Check if machine_id mismatch (401)
        if (errorStr.includes("401") && errorStr.includes("machine")) {
          state.isBotRunning = false;
          startErrorCountdown();
          return;
        }
        
        showToast(`Error: ${error}`, "error");
        
        // Wait and continue loop
        if (state.isBotRunning) {
          const nextIndex = state.currentProductSetIndex;
          const nextProductSet = state.selectedProductSets[nextIndex];
          const nextSetName = nextProductSet ? nextProductSet.name : "Retry";
          startDelayCountdown(currentDelay, nextSetName);
          await new Promise(resolve => setTimeout(resolve, delayMs));
          stopDelayCountdown();
          if (state.isBotRunning) {
            botLoop();
          }
        }
      }
      
    } catch (error) {
      state.errorCount++;
      
      const errorStr = String(error);
      if (errorStr.includes("400") || errorStr.includes("422")) {
        if (state.errorCount >= 3) {
          state.isBotRunning = false;
          stopDelayCountdown();
          startErrorCountdown();
          return;
        }
      }
      
      showToast(`Error: ${error}`, "error");
      
      // Get delay again in case it changed
      const delayInput = byId<HTMLInputElement>("delay-input");
      const currentDelay = parseInt(delayInput.value) || 60;
      const delayMs = currentDelay * 1000;
      
      startDelayCountdown(currentDelay, "Retry...");
      await new Promise(resolve => setTimeout(resolve, delayMs));
      stopDelayCountdown();
      if (state.isBotRunning) botLoop();
    }
  }
  
  botLoop();
}

function stopBot() {
  state.isBotRunning = false;
  stopDelayCountdown(); // Stop countdown timer
  byId("btn-start-bot").classList.remove("hidden");
  byId("btn-stop-bot").classList.add("hidden");
  byId("bot-status-text").textContent = "Dihentikan";
  byId("bot-last-action").textContent = "";
  byId("bot-session-ids").classList.add("hidden");
  byId("bot-session-ids-list").innerHTML = "";
  
  // Update rotation visualization when stopped
  renderProductSetsRotation();
}

// ==================== Event Listeners ====================

window.addEventListener("DOMContentLoaded", () => {
  // Step 0
  byId("login-form").addEventListener("submit", handleLogin);
  byId("btn-redeem-license").addEventListener("click", () => showModal("modal-redeem-license"));
  byId("btn-redeem-license-header").addEventListener("click", () => showModal("modal-redeem-license"));
  byId("redeem-license-form").addEventListener("submit", handleRedeemLicense);
  byId("btn-close-redeem-modal").addEventListener("click", () => hideModal("modal-redeem-license"));
  
  // Change password
  byId("btn-change-password-header").addEventListener("click", () => {
    if (state.currentUser) {
      byId<HTMLInputElement>("change-password-email").value = state.currentUser.email;
      showModal("modal-change-password");
    }
  });
  byId("change-password-form").addEventListener("submit", handleChangePassword);
  byId("btn-close-change-password-modal").addEventListener("click", () => hideModal("modal-change-password"));
  
  // Logout
  byId("btn-logout-header").addEventListener("click", () => {
    state.currentUser = null;
    state.currentPassword = "";
    state.selectedAccount = null;
    state.selectedNiche = null;
    if (state.botIntervalId) clearInterval(state.botIntervalId);
    state.isBotRunning = false;
    byId("global-header").classList.add("hidden");
    showStep(0);
  });
  
  // Step 1
  byId("btn-add-account-qr").addEventListener("click", () => {
    showModal("modal-qr-scan");
  });
  byId("btn-add-account-manual").addEventListener("click", () => {
    showModal("modal-add-account-manual");
  });
  byId("btn-generate-qr").addEventListener("click", generateQR);
  byId("btn-close-qr-modal").addEventListener("click", () => {
    if (qrStatusInterval) clearInterval(qrStatusInterval);
    hideModal("modal-qr-scan");
  });
  byId("add-account-manual-form").addEventListener("submit", handleAddAccountManual);
  byId("btn-close-manual-modal").addEventListener("click", () => hideModal("modal-add-account-manual"));
  
  // Step 1 - Back button
  byId("btn-step-1-back").addEventListener("click", () => {
    showStep(0);
  });
  
  // Breadcrumb navigation using data attributes
  document.querySelectorAll("[data-breadcrumb='step-1']").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (state.isBotRunning && state.currentStep === 3) {
        const confirmed = await confirmDialog("Bot sedang berjalan. Hentikan bot terlebih dahulu?");
        if (!confirmed) {
          return;
        }
        stopBot();
      }
      showStep(1);
    });
  });
  
  document.querySelectorAll("[data-breadcrumb='step-2']").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (state.isBotRunning && state.currentStep === 3) {
        const confirmed = await confirmDialog("Bot sedang berjalan. Hentikan bot terlebih dahulu?");
        if (!confirmed) {
          return;
        }
        stopBot();
      }
      showStep(2);
    });
  });
  
  byId("btn-step-1-next").addEventListener("click", () => {
    if (state.selectedAccount) {
      showStep(2);
      loadNiches();
    } else {
      showToast("Pilih akun terlebih dahulu", "error");
    }
  });
  
  // Step 2 - Niches
  byId("btn-create-niche").addEventListener("click", openCreateNicheModal);
  byId("niche-form").addEventListener("submit", handleNicheForm);
  byId("btn-close-niche-modal").addEventListener("click", () => hideModal("modal-niche"));
  
  // Step 2 - Product Sets
  byId("btn-create-product-set").addEventListener("click", openCreateProductSetModal);
  byId("product-set-form").addEventListener("submit", handleProductSetForm);
  byId("btn-close-product-set-modal").addEventListener("click", () => hideModal("modal-product-set"));
  
  // Step 2 - Product Set Items
  byId("btn-add-items").addEventListener("click", () => {
    if (currentProductSetForItems) {
      openAddItemsModal(currentProductSetForItems);
    }
  });
  byId("add-items-form").addEventListener("submit", handleAddItemsForm);
  byId("btn-close-add-items-modal").addEventListener("click", () => hideModal("modal-add-items"));
  byId("btn-close-product-set-detail").addEventListener("click", () => {
    byId("product-set-detail-panel").classList.add("hidden");
    currentProductSetForItems = null;
  });
  
  // Step 2 - Back button
  byId("btn-step-2-back").addEventListener("click", () => {
    showStep(1);
  });
  
  
  // Step 2 - Next button
  byId("btn-step-2-next").addEventListener("click", () => {
    if (state.selectedNiche) {
      // Reload product sets for selected niche to get all sets
      loadProductSetsForNiche(state.selectedNiche.id).then(() => {
        showStep(3);
      });
    } else {
      showToast("Pilih niche terlebih dahulu", "error");
    }
  });
  
  // Step 3 - Delay input (can be changed during bot run)
  byId("delay-input").addEventListener("input", (e) => {
    const delay = parseInt((e.target as HTMLInputElement).value) || 60;
    state.delay = delay;
  });
  
  // Close niche detail
  byId("btn-close-niche-detail").addEventListener("click", () => {
    byId("niche-detail-panel").classList.add("hidden");
    byId("product-set-detail-panel").classList.add("hidden");
    currentProductSetForItems = null;
  });
  
  // Step 3 - Back button
  byId("btn-step-3-back").addEventListener("click", async () => {
    if (state.isBotRunning) {
      const confirmed = await confirmDialog("Bot sedang berjalan. Hentikan bot terlebih dahulu?");
      if (!confirmed) {
        return;
      }
      stopBot();
    }
    showStep(2);
  });
  
  // Step 3 - Refresh session buttons
  byId("btn-refresh-session").addEventListener("click", async () => {
    await checkSessions();
  });
  
  byId("btn-refresh-session-list").addEventListener("click", async () => {
    await checkSessions();
  });
  
  // Step 3
  byId("btn-start-bot").addEventListener("click", startBot);
  byId("btn-stop-bot").addEventListener("click", stopBot);
});
