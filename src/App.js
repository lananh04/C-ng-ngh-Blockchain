import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';

function App() {
  const [account, setAccount] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [productName, setProductName] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [products, setProducts] = useState([]); 
  const [totalItemsCount, setTotalItemsCount] = useState(0); 

  // ==========================================
  // ⚠️ ĐỪNG QUÊN: Dán địa chỉ Contract mới chạy được của bạn vào đây nhé
  // ==========================================
  const contractAddress = "0xeA16Ae36B242609186d90C3247DaAe313BFBD734"; 
  
  const contractABI = [
    {
      "inputs": [
        { "internalType": "string", "name": "_name", "type": "string" },
        { "internalType": "uint256", "name": "_price", "type": "uint256" }
      ],
      "name": "listItem",
      "outputs": [],
      "stateMutability": "payable",
      "type": "function"
    },
    {
      "inputs": [
        { "internalType": "uint256", "name": "_id", "type": "uint256" }
      ],
      "name": "buyItem",
      "outputs": [],
      "stateMutability": "payable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "itemCount",
      "outputs": [
        { "internalType": "uint256", "name": "", "type": "uint256" }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        { "internalType": "uint256", "name": "", "type": "uint256" }
      ],
      "name": "items",
      "outputs": [
        { "internalType": "uint256", "name": "id", "type": "uint256" },
        { "internalType": "address payable", "name": "seller", "type": "address" },
        { "internalType": "string", "name": "name", "type": "string" },
        { "internalType": "uint256", "name": "price", "type": "uint256" },
        { "internalType": "bool", "name": "isSold", "type": "bool" }
      ],
      "stateMutability": "view",
      "type": "function"
    }
  ];

  const SEPOLIA_CHAIN_ID = '0xaa36a7'; 

  const switchToSepoliaNetwork = async () => {
    try {
      if (!window.ethereum) throw new Error("Chưa cài đặt MetaMask");
      const currentChainId = await window.ethereum.request({ method: 'eth_chainId' });
      if (currentChainId !== SEPOLIA_CHAIN_ID) {
        setStatusMessage("Đang yêu cầu chuyển sang mạng Sepolia...");
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: SEPOLIA_CHAIN_ID }],
        });
      }
      return true;
    } catch (error) {
      console.error("Lỗi chuyển mạng:", error);
      setStatusMessage("Lỗi: Vui lòng chuyển MetaMask sang mạng Sepolia!");
      return false;
    }
  };

  const fetchProducts = async () => {
    try {
      if (!window.ethereum || !contractAddress) return;
      
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const contract = new ethers.Contract(contractAddress, contractABI, provider);
      
      const totalItems = await contract.itemCount();
      const count = totalItems.toNumber();
      setTotalItemsCount(count); 
      
      const tempProducts = [];
      
      for (let i = 1; i <= count; i++) {
        try {
          const item = await contract.items(i);
          if (item && item.name) {
            tempProducts.push({ 
              id: item.id ? item.id.toNumber() : i, 
              name: item.name, 
              price: ethers.utils.formatEther(item.price), 
              seller: item.seller, 
              isSold: item.isSold 
            });
          }
        } catch (itemError) {
          console.error(`Lỗi đọc phần tử thứ ${i}:`, itemError);
        }
      }
      setProducts(tempProducts);
    } catch (error) {
      console.error("Lỗi quét Blockchain:", error);
    }
  };

  const connectWallet = async () => {
    try {
      if (window.ethereum) {
        const isReady = await switchToSepoliaNetwork();
        if (!isReady) return;
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        setAccount(accounts[0]);
        setIsConnected(true);
        setStatusMessage("Kết nối ví thành công!");
        fetchProducts(); 
      } else {
        alert("Vui lòng cài đặt MetaMask!");
      }
    } catch (error) {
      console.error("Lỗi kết nối ví:", error);
    }
  };

  const handleListing = async (e) => {
    e.preventDefault();
    if (!productName || !productPrice) {
      alert("Vui lòng nhập tên và giá sản phẩm!");
      return;
    }

    try {
      const isReady = await switchToSepoliaNetwork();
      if (!isReady) return;

      setStatusMessage("Đang gọi MetaMask xác nhận...");
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contract = new ethers.Contract(contractAddress, contractABI, signer);

      const priceInWei = ethers.utils.parseEther(productPrice);
      const tx = await contract.listItem(productName, priceInWei);
      
      setStatusMessage("Giao dịch đang xử lý... Vui lòng đợi.");
      await tx.wait(); 
      
      setStatusMessage("🎉 Niêm yết sản phẩm lên Blockchain thành công!");
      setProductName('');
      setProductPrice('');
      fetchProducts();
    } catch (error) {
      console.error("Giao dịch thất bại:", error);
      setStatusMessage("Giao dịch bị từ chối hoặc lỗi gas.");
    }
  };

  // 🔥 HÀM MỚI TÍCH HỢP: XỬ LÝ MUA HÀNG DÀNH CHO NGƯỜI MUA
  const handleBuyItem = async (id, priceInEth) => {
    try {
      const isReady = await switchToSepoliaNetwork();
      if (!isReady) return;

      setStatusMessage(`Đang gọi MetaMask để mua sản phẩm ID #${id}...`);

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contract = new ethers.Contract(contractAddress, contractABI, signer);

      // Chuyển đổi giá từ ETH ngược lại Wei để gửi kèm giao dịch
      const priceInWei = ethers.utils.parseEther(priceInEth);

      // Gọi hàm buyItem và đính kèm tiền mặt qua thuộc tính { value: ... }
      const tx = await contract.buyItem(id, { value: priceInWei });
      
      setStatusMessage("Thanh toán đang được xếp hàng trên Blockchain... Vui lòng đợi.");
      await tx.wait(); // Chờ khối xác nhận thành công

      setStatusMessage(`🎉 Tuyệt vời! Bạn đã mua thành công sản phẩm ID #${id}!`);
      fetchProducts(); // Cập nhật lại giao diện trạng thái "Đã bán"
    } catch (error) {
      console.error("Giao dịch mua hàng thất bại:", error);
      setStatusMessage("Mua hàng thất bại (Có thể do bạn từ chối ký ví hoặc tự mua hàng của chính mình).");
    }
  };

  useEffect(() => {
    const checkWalletOnLoad = async () => {
      if (window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          if (accounts.length > 0) {
            setAccount(accounts[0]);
            setIsConnected(true);
          }
        } catch (err) {
          console.error(err);
        }

        window.ethereum.on('accountsChanged', (accounts) => {
          if (accounts.length > 0) {
            setAccount(accounts[0]);
            setIsConnected(true);
          } else {
            setIsConnected(false);
            setAccount('');
            setProducts([]);
            setTotalItemsCount(0);
          }
        });

        window.ethereum.on('chainChanged', () => {
          window.location.reload();
        });
      }
    };
    checkWalletOnLoad();
  }, []);

  useEffect(() => {
    if (isConnected) {
      fetchProducts();
    }
  }, [isConnected]);

  return (
    <div style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto', fontFamily: 'Arial' }}>
      <h1 style={{ color: '#0066cc', textAlign: 'center' }}>HỆ THỐNG SÀN GIAO DỊCH THƯƠNG MẠI PHI TẬP TRUNG</h1>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', backgroundColor: '#f5f5f5', padding: '10px 20px', borderRadius: '5px', marginBottom: '10px' }}>
        <div><strong>Trạng thái: </strong>{isConnected ? <span style={{ color: 'green' }}>🟢 Đã kết nối</span> : <span style={{ color: 'red' }}>🔴 Chưa kết nối</span>}</div>
        <div><strong>Ví của bạn: </strong><span style={{ fontSize: '13px', color: '#555' }}>{isConnected ? account : "Chưa kết nối"}</span></div>
      </div>

      {statusMessage && <div style={{ textAlign: 'center', color: '#ff6600', fontWeight: 'bold', marginBottom: '15px' }}>ℹ️ {statusMessage}</div>}

      {!isConnected && (
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <button onClick={connectWallet} style={{ backgroundColor: '#0066cc', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>Kết nối ví MetaMask</button>
        </div>
      )}

      <div style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '20px' }}>
        <h3 style={{ textAlign: 'center', marginTop: 0 }}>ANH/CHỊ ĐĂNG BÁN MẶT HÀNG MỚI (PHÂN HỆ NGƯỜI BÁN)</h3>
        <form onSubmit={handleListing} style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <input type="text" placeholder="Tên mặt hàng..." value={productName} onChange={(e) => setProductName(e.target.value)} style={{ flex: 2, padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }} />
          <input type="number" step="0.0001" placeholder="Giá bán (ETH)" value={productPrice} onChange={(e) => setProductPrice(e.target.value)} style={{ flex: 1, padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }} />
          <button type="submit" style={{ backgroundColor: '#4caf50', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Niêm yết lên Blockchain</button>
        </form>
      </div>

      <div style={{ marginTop: '30px' }}>
        <h3 style={{ textAlign: 'center', marginBottom: '5px' }}>DANH SÁCH MẶT HÀNG ĐANG GIAO DỊCH</h3>
        <div style={{ textAlign: 'right', marginBottom: '10px', fontWeight: 'bold', color: '#0066cc' }}>
          📊 Tổng số mặt hàng trên hệ thống: <span style={{ backgroundColor: '#0066cc', color: 'white', padding: '2px 8px', borderRadius: '10px' }}>{totalItemsCount}</span>
        </div>
        
        {products.length === 0 ? (
          <p style={{ color: '#888', fontStyle: 'italic', textAlign: 'center', marginTop: '20px' }}>Chưa có sản phẩm nào được hiển thị.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '5px' }}>
            <thead>
              <tr style={{ backgroundColor: '#0066cc', color: 'white' }}>
                <th style={{ padding: '12px', border: '1px solid #ddd' }}>ID</th>
                <th style={{ padding: '12px', border: '1px solid #ddd' }}>Tên Sản Phẩm</th>
                <th style={{ padding: '12px', border: '1px solid #ddd' }}>Giá (ETH)</th>
                <th style={{ padding: '12px', border: '1px solid #ddd' }}>Người bán</th>
                <th style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'center' }}>Hành động / Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {products.map((item) => (
                <tr key={item.id}>
                  <td style={{ padding: '12px', border: '1px solid #ddd', fontWeight: 'bold' }}>{item.id}</td>
                  <td style={{ padding: '12px', border: '1px solid #ddd' }}>{item.name}</td>
                  <td style={{ padding: '12px', border: '1px solid #ddd', color: '#ff6600', fontWeight: 'bold' }}>{item.price} ETH</td>
                  <td style={{ padding: '12px', border: '1px solid #ddd', fontSize: '11px', wordBreak: 'break-all' }}>{item.seller}</td>
                  <td style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'center' }}>
                    {item.isSold ? (
                      <span style={{ color: 'red', fontWeight: 'bold' }}>🔴 Đã bán</span>
                    ) : (
                      <button 
                        onClick={() => handleBuyItem(item.id, item.price)}
                        style={{
                          backgroundColor: '#ff9900',
                          color: 'white',
                          border: 'none',
                          padding: '6px 12px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontWeight: 'bold'
                        }}
                      >
                        🛒 Mua Ngay
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default App;