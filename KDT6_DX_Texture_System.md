# KDT6_DX 텍스처 시스템 — 설명편 · 응용편

강사님의 KDT6_DX 수업에서 올라온 텍스처 렌더링 시스템을 정리한 문서다.
1부(설명편)는 "각 파일/클래스가 왜 필요한지" 순서대로 풀어쓰고,
2부(응용편)는 "실제로 게임 코드에서 이걸 어떻게 쓰는지" 시나리오 중심으로 다룬다.

---

## Part 1. 설명편 — 텍스처가 화면에 박히기까지

### 1.1 큰 그림: 3단계 파이프라인

디스크에 있는 PNG 한 장을 쉐이더가 샘플링하기까지는 3단계를 거친다.

```
┌────────────┐   DirectXTex   ┌──────────────────┐   D3D11   ┌────────────────────┐
│  파일      │ ─────────────▶ │ DirectX::        │ ────────▶ │ ID3D11Shader       │
│ (.png/.dds)│                │   ScratchImage   │           │   ResourceView(SRV)│
└────────────┘                └──────────────────┘           └────────────────────┘
     디스크                       CPU(RAM)                           GPU(VRAM)
```

1. **파일 → ScratchImage (CPU 로드)**
   PNG/JPG는 `LoadFromWICFile`, DDS는 `LoadFromDDSFile`, TGA는 `LoadFromTGAFile`.
   확장자에 따라 로더가 달라진다. 결과는 `DirectX::ScratchImage` 구조체에 담긴다.
   여기까지는 그냥 RAM에 박힌 픽셀 덩어리일 뿐, GPU는 아직 모른다.

2. **ScratchImage → SRV (GPU 업로드)**
   `DirectX::CreateShaderResourceView`를 호출하면 ScratchImage의 픽셀을
   GPU VRAM으로 업로드하고, 그걸 쉐이더가 읽을 수 있는 핸들
   `ID3D11ShaderResourceView`(SRV)로 감싼다.

3. **SRV → 쉐이더 바인딩 (드로우 직전)**
   드로우 콜마다 `VSSetShaderResources` / `PSSetShaderResources`로
   SRV를 특정 레지스터(`t0`, `t1`…)에 꽂아 넣는다. 이때부터 HLSL에서
   `Texture2D gBaseTexture : register(t0)`가 유효해진다.

이 3단계를 각각 담당하는 클래스가 `Texture`이고, 그걸 이름으로 찾기 쉽게
묶은 게 `TextureManager`다. 그 위에 재질 개념을 입힌 게 `Material`.

### 1.2 DirectXTex — Microsoft 공식 텍스처 로더

DirectX11 자체는 이미지 디코딩 기능이 없다. `.png`를 들고 와서
`ID3D11Device::CreateTexture2D(... 어떤 바이트 포인터 ...)` 이렇게 넘겨야 하는데,
"PNG에서 픽셀 바이트를 뽑아내는" 과정이 필요하다.

**DirectXTex**는 Microsoft가 오픈소스로 푼 그 디코딩 레이어다.
PNG/JPG/BMP/TIFF는 WIC 기반으로, DDS/TGA는 자체 파서로 읽어온다.

- 리포지토리: `https://github.com/microsoft/DirectXTex`
- KDT6_DX는 **사전 빌드된 .lib**를 `KDT6_DX/Game2D/ThirdParty/`에 그대로 담아둔다.
  - `DirectXTex.h`, `DirectXTex.inl` (헤더)
  - `DirectXTex.lib` (릴리즈)
  - `DirectXTex_Debug.lib` (디버그)

`Texture.cpp` 상단의 `#pragma comment(lib, ...)`가 디버그/릴리즈를 전환해 준다.

```cpp
#ifdef _DEBUG
#pragma comment(lib, "DirectXTex_Debug.lib")
#else
#pragma comment(lib, "DirectXTex.lib")
#endif
```

> ⚠️ 최신 DirectXTex를 직접 빌드해서 쓸 경우, Debug 구성도 파일명이 그냥
> `DirectXTex.lib` 하나로 떨어진다. `_Debug` 접미사는 KDT6_DX가 번들로 들고 있는
> 구버전 빌드에서만 유효하다.

### 1.3 `FTextureInfo` 구조체 — 텍스처 한 장의 모든 것

```cpp
struct FTextureInfo
{
    DirectX::ScratchImage            _image;     // CPU 픽셀 데이터
    ComPtr<ID3D11ShaderResourceView> _srv;       // GPU 핸들
    uint32                           _width;
    uint32                           _height;
    std::wstring                     _fileName;
};
```

- `_image`는 CPU 쪽 데이터이므로 SRV를 만든 뒤에는 사실상 다시 쓸 일이 없다.
  남겨두는 이유는 (a) 디버깅용, (b) 나중에 밉맵 재생성 등 재처리가 필요할 때,
  (c) SRV가 파괴되고 재생성되어야 할 때 원본을 다시 업로드할 수 있게 하기 위함이다.
- `_srv`는 실제로 쉐이더에 꽂아넣는 객체. `ComPtr`이라서 소멸 시 자동 해제.
- `_width/_height`는 상수버퍼(`FMaterialCBufferData`)에 넘겨주기 위해 캐싱.

### 1.4 `Texture` 클래스 — 3단계 로직의 구현체

```cpp
class Texture : public Asset
{
protected:
    std::vector<FTextureInfo> _textureInfos;   // 한 Texture 객체가 여러 장을 가질 수도 있음

public:
    bool LoadTexture(const std::wstring& fileName);
    void SetShader(int32 registerNum, int32 shaderBufferType, int32 textureIndex);
    void ResetShader(int32 registerNum, int32 shaderBufferType);

protected:
    bool CreateResourceView(int32 idx);
};
```

**`LoadTexture(fileName)`** — 위의 1단계+2단계를 한 번에 처리한다.

```cpp
bool Texture::LoadTexture(const std::wstring& fileName)
{
    // ① Resources/Texture 아래에서 파일 경로 해석
    std::filesystem::path filePath;
    auto resPath = DirectoryManager::Instance().GetPath("Resources");
    DirectoryManager::Instance().GetDiretory(resPath.value(), "Texture", filePath);
    DirectoryManager::Instance().GetFile(filePath, fileName, filePath);

    // ② 확장자에 따라 로더 선택
    FTextureInfo texture;
    if (DirectoryManager::Instance().IsExtension(filePath, ".DDS"))
        DirectX::LoadFromDDSFile(filePath.wstring().c_str(), DirectX::DDS_FLAGS_NONE, nullptr, texture._image);
    else if (DirectoryManager::Instance().IsExtension(filePath, ".TGA"))
        DirectX::LoadFromTGAFile(filePath.wstring().c_str(), nullptr, texture._image);
    else
        DirectX::LoadFromWICFile(filePath.wstring().c_str(), DirectX::WIC_FLAGS_NONE, nullptr, texture._image);

    // ③ 메타데이터 캐싱
    texture._fileName = fileName;
    texture._width  = texture._image.GetImages()->width;
    texture._height = texture._image.GetImages()->height;

    _textureInfos.emplace_back(std::move(texture));

    // ④ GPU 업로드 + SRV 생성
    return CreateResourceView(_textureInfos.size() - 1);
}
```

> 💡 `DirectoryManager::IsExtension`이 `std::string::compare`의 반환값을
> 잘못 해석한 탓에 이전 버전에서는 항상 뒤집힌 결과를 내고 있었다. 수업 도중에
> 수정되었으니, 본인 프로젝트에서도 `==` 비교로 되어 있는지 반드시 확인할 것.

**`CreateResourceView(idx)`** — 이 한 줄이 2단계 전체다.

```cpp
DirectX::CreateShaderResourceView(
    Device::Instance().GetDevice().Get(),   // ID3D11Device*
    _textureInfos[idx]._image.GetImages(),   // 이미지 픽셀
    _textureInfos[idx]._image.GetImageCount(),
    _textureInfos[idx]._image.GetMetadata(),
    _textureInfos[idx]._srv.GetAddressOf()   // 결과 SRV
);
```

**`SetShader(regi, type, idx)`** — 3단계. 드로우 콜 직전에 호출된다.

```cpp
void Texture::SetShader(int32 registerNum, int32 shaderBufferType, int32 textureIndex)
{
    if (shaderBufferType & SHADER_TYPE::VERTEX)
        context->VSSetShaderResources(registerNum, 1, _textureInfos[textureIndex]._srv.GetAddressOf());

    if (shaderBufferType & SHADER_TYPE::PIXEL)
        context->PSSetShaderResources(registerNum, 1, _textureInfos[textureIndex]._srv.GetAddressOf());
}
```

`SHADER_TYPE::VERTEX | PIXEL` 비트 플래그로 어느 단계에 꽂을지 지정한다.
대부분 픽셀 쉐이더에만 바인딩하므로 기본값은 `PIXEL`.

**`ResetShader(regi, type)`** — 드로우 끝난 뒤 해당 슬롯을 nullptr로 리셋한다.
이걸 안 하면 "예전 드로우에서 꽂아뒀던 SRV가 다음 드로우에서도 유효"해져서,
엉뚱한 텍스처가 출력되거나 리소스 해제가 지연되는 문제가 생길 수 있다.

### 1.5 `TextureManager` — 이름으로 찾는 에셋 매니저

```cpp
class TextureManager : public SubManager
{
    std::unordered_map<std::string, Ptr<Texture>> _textures;

public:
    bool Init();
    bool LoadTexture(const std::string& name, const std::wstring& fileName);
    Ptr<Texture> FindTexture(const std::string& name);
    virtual void Destroy() override;
};
```

- `AssetManager`에 `eAssetType::TEXTURE`로 등록된다.
- 게임 코드에서는 `TEXTURE_MANAGER->FindTexture("muzi")` 한 줄로 조회.
- `LoadTexture("muzi", L"muzi-removebg-preview.png")` 처럼
  **논리 이름**과 **실제 파일명**을 분리해서 등록한다. 나중에 파일명이 바뀌어도
  게임 코드는 건드릴 필요가 없다.

등록 순서가 중요하다. `AssetManager::Init`에서는
**Texture → Material → Mesh** 순으로 등록된다. Mesh가 `DefaultMaterial`을
참조하기 때문에 MaterialManager가 먼저 살아 있어야 하고, 그 MaterialManager는
ShaderManager의 `Material` 상수버퍼를 참조하기 때문에 **ShaderManager도
AssetManager보다 먼저 Init해야 한다**.

```cpp
// GameEngine::InitManager — 순서가 생명
ShaderManager::Instance().Init();
AssetManager::Instance().Init();   // 내부에서 Texture/Material/Mesh 순
```

### 1.6 샘플러 — 픽셀을 "어떻게" 읽을지 정하는 규칙

텍스처 자체는 픽셀 덩어리일 뿐이다. 메쉬의 UV 좌표 `(0.37, 0.82)`를 받았을 때
"그 위치의 색은 무엇인가?"를 결정하는 건 **샘플러**다.

`ShaderManager`는 Init 시점에 3종류 샘플러를 만들어 `_samplers[3]`에 캐싱한다.

```cpp
ComPtr<ID3D11SamplerState> _samplers[TEXURE_SAMPLE_END];

void ShaderManager::CreateSampler()
{
    D3D11_SAMPLER_DESC desc = {};
    desc.AddressU = desc.AddressV = desc.AddressW = D3D11_TEXTURE_ADDRESS_WRAP;
    desc.MinLOD = 0;
    desc.MaxLOD = D3D11_FLOAT32_MAX;

    // 포인트: 가장 가까운 1픽셀. 픽셀 아트에 적합.
    desc.Filter = D3D11_FILTER_MIN_MAG_MIP_POINT;
    device->CreateSamplerState(&desc, _samplers[TEXTURE_SAMPLE_POINT].GetAddressOf());

    // 선형: 주변 4픽셀 가중 평균. 부드럽게 보이지만 픽셀 아트엔 부적합.
    desc.Filter = D3D11_FILTER_MIN_MAG_MIP_LINEAR;
    device->CreateSamplerState(&desc, _samplers[TEXTURE_SAMPLE_LINEAR].GetAddressOf());

    // 이방성: 경사진 표면에서 선명함 유지. 2D에서는 거의 쓰지 않음.
    desc.Filter = D3D11_FILTER_ANISOTROPIC;
    desc.MaxAnisotropy = 16;
    device->CreateSamplerState(&desc, _samplers[TEXTURE_SAMPLE_ANISOTROPIC].GetAddressOf());
}
```

- `AddressU/V/W = WRAP`: UV가 1을 넘어가면 다시 0부터 반복(타일링).
  CLAMP로 바꾸면 경계 픽셀이 늘어나고, MIRROR로 바꾸면 좌우반전 반복.
- `SetSample(type)` 호출 시 `PSSetSamplers(0, 1, ...)`로 슬롯 `s0`에 꽂는다.

### 1.7 상수버퍼 `FMaterialCBufferData` — 재질 파라미터를 GPU로

```cpp
struct FMaterialCBufferData
{
    FVector4D _baseColor;   // 전체 색조
    float     _opacity;     // 투명도
    int32     _textureWidth;
    int32     _textureHeight;
    float     _empty;       // 16바이트 정렬용 패딩
};
```

상수버퍼는 **16바이트(=float4) 경계에 정렬되어야 한다**. 위 구조체는
`float4(16) + float(4) + int(4) + int(4) + float(4) = 32바이트`로
이미 16의 배수지만, 강사님 스타일은 항상 명시적으로 `_empty`를 넣어 뒀다.

> 📝 강사님 원본 코드에는 `_basaColor`, `_textureWidht` 같은 오타가 그대로 있다.
> 본인 프로젝트로 옮길 때는 가독성을 위해 `_baseColor`, `_textureWidth`로
> 수정해도 무방하다.

HLSL 쪽 대응(`Share.fx`):

```hlsl
cbuffer Material : register(b1)
{
    float4 gMtrlBaseColor;
    float  gMtrlOpacity;
    int    gMtrlTextureWidth;
    int    gMtrlTextureHeight;
    float  gEmpty;
}
```

`register(b1)`인 이유는 `Transform`이 VS의 `b0`, `Color`가 PS의 `b0`를
이미 쓰고 있기 때문이다. VS와 PS의 `b0`는 슬롯이 분리되어 있어서 충돌하지 않지만,
같은 PS 안에서는 `Color`와 `Material`이 겹칠 수 없으므로 `Material`을 `b1`로 밀었다.

### 1.8 `MaterialCBuffer` — CPU → GPU 복사 어댑터

```cpp
class MaterialCBuffer : public CBuffer
{
    FMaterialCBufferData _data;
public:
    virtual void Update() override { SetData(&_data); }

    void SetBaseColor(const FVector4D& color);
    void SetOpacity(float op);
    void SetTextureWidth(int32 w);
    void SetTextureHeight(int32 h);
};
```

CPU 쪽의 `_data`를 수정하는 세터들이 있고, `Update()`가 호출될 때
부모 클래스 `CBuffer::SetData`가 `ID3D11DeviceContext::UpdateSubresource` 류의
호출로 GPU 상수버퍼를 덮어쓴다. 즉 **"세터 호출"만으로는 아직 GPU는 모른다.**
`Material::SetMaterial()` 내부에서 `_buffer->Update()`까지 밟아야 실제로 전송된다.

### 1.9 `Material` — 텍스처 + 쉐이더 + 상수버퍼 + 샘플러 묶음

```cpp
class Material : public Asset
{
    friend class MaterialManager;

protected:
    std::vector<FMaterialTextureInfo> _textures;   // 여러 장 바인딩 가능
    Ptr<Shader>         _pixelShader;              // 어떤 PS를 쓸지
    Ptr<MaterialCBuffer> _buffer;                  // 어떤 cbuffer를 쓸지
    eTextureSampleType  _sampleType;
    FVector4D           _baseColor = {1,1,1,1};
    float               _opacity  = 1.f;

public:
    void SetBaseColor(const FVector4D& color);
    void SetOpacity(float op);
    void SetSamplerType(eTextureSampleType type);

    void AddTexture(Ptr<Texture> t, int32 regi, int32 type = SHADER_TYPE::PIXEL, int32 idx = 0);
    void AddTexture(const std::string& name, int32 regi, ...);
    void SetPixelShader(const std::string& name);

    void SetMaterial();    // 드로우 직전 호출
    void ResetMaterial();  // 드로우 직후 호출

    Ptr<Material> Clone(); // 복사본 생성(값 공유 방지)
};
```

**`SetMaterial()`의 내부 흐름**이 이 시스템 전체의 하이라이트다.

```cpp
void Material::SetMaterial()
{
    // ① CPU 파라미터 → cbuffer 구조체 → GPU 전송
    _buffer->SetBaseColor(_baseColor);
    _buffer->SetOpacity(_opacity);
    _buffer->Update();

    // ② 이 머티리얼이 쓸 샘플러를 s0에 바인딩
    ShaderManager::Instance().SetSample(_sampleType);

    // ③ 이 머티리얼의 픽셀 쉐이더를 활성화
    _pixelShader->SetShader();

    // ④ 이 머티리얼이 보유한 모든 텍스처를 지정 레지스터에 꽂음
    for (auto& info : _textures)
    {
        Ptr<Texture> tex = Lock<Texture>(info._texture);
        tex->SetShader(info._registerNum, info._shaderBufferType, info._textureIndex);
    }
}
```

즉 한 번의 `SetMaterial()` 호출로 **cbuffer 업로드 → 샘플러 바인딩 →
PS 스위치 → SRV 바인딩**이 한 번에 끝난다. 이게 "재질"이라는 추상화의 본질이다.

`Clone()`은 왜 필요한가? 같은 `DefaultMaterial`을 여러 액터가 써도
**각 액터가 다른 색조/투명도를 가지기 위해서다**. 만약 공유 포인터로
동일 인스턴스를 쓰면 플레이어가 반투명해질 때 몬스터도 같이 반투명해진다.
`MaterialManager`는 **원본 머티리얼을 이름으로 관리**하고,
**사용 시점에는 `CreateMaterialInstance`가 복사본을 돌려준다.**

### 1.10 `MaterialManager` — 재질 레지스트리

```cpp
class MaterialManager : public SubManager
{
    std::unordered_map<std::string, Ptr<Material>> _materials;

public:
    bool Init()
    {
        return CreateMaterial(
            "DefaultMaterial",
            "MaterialPixelShader",
            eTextureSampleType::TEXTURE_SAMPLE_LINEAR);
    }

    bool CreateMaterial(const std::string& name, const std::string& psName, eTextureSampleType t);
    Ptr<Material> CreateMaterialInstance(const std::string& name);  // Clone 리턴
    Ptr<Material> FindMaterial(const std::string& name);            // 원본 리턴
};
```

`CreateMaterial`이 핵심이다.

```cpp
Ptr<Material> mat = New<Material>();
mat->SetName(name);
mat->SetSamplerType(sampleType);
mat->SetPixelShader(pixelShader);
mat->_buffer = ShaderManager::Instance().FindCBuffer<MaterialCBuffer>("Material");
_materials[name] = mat;
```

`mat->_buffer`에 `friend class MaterialManager` 권한으로 직접 접근한다.
**이 한 줄 때문에 ShaderManager가 AssetManager보다 먼저 Init해야 한다.**
순서가 뒤집히면 `FindCBuffer`가 nullptr을 반환해 조용히 렌더링이 망가진다.

### 1.11 쉐이더 쪽: `StaticMeshShader`와 `MaterialPixelShader`

#### 입력 레이아웃

`StaticMeshShader`는 `FVertexTexture`를 입력으로 받는다.

```cpp
struct FVertexTexture
{
    FVector3D _pos;  // 12 bytes
    FVector2D _uv;   //  8 bytes
};

// Init()
AddInputLayoutDesc("POSITION", 0, DXGI_FORMAT_R32G32B32_FLOAT, 0, 12, D3D11_INPUT_PER_VERTEX_DATA, 0);
AddInputLayoutDesc("TEXCOORD", 0, DXGI_FORMAT_R32G32_FLOAT,    0,  8, D3D11_INPUT_PER_VERTEX_DATA, 0);
CreateInputLayout();
```

슬롯 0에 POSITION(12바이트), 다음 8바이트가 TEXCOORD. 기존 `ColorMeshShader`는
TEXCOORD 대신 COLOR가 있었으므로, **입력 레이아웃이 다른 쉐이더끼리는
같은 버텍스 버퍼를 공유할 수 없다**.

#### VS (Mesh.fx)

```hlsl
#include "Share.fx"

struct VS_Input_Tex  { float3 Pos : POSITION; float2 UV : TEXCOORD; };
struct VS_Ouput_Tex  { float4 Pos : SV_POSITION; float2 UV : TEXCOORD; };

VS_Ouput_Tex MaterialMeshVS(VS_Input_Tex input)
{
    VS_Ouput_Tex output = (VS_Ouput_Tex) 0;
    output.Pos = mul(float4(input.Pos, 1.f), gWVP);  // Transform cbuffer(b0)
    output.UV  = input.UV;
    return output;
}
```

VS는 World·View·Proj을 곱해서 클립 공간 좌표를 만드는 것만 한다.
UV는 그대로 PS로 패스스루.

#### PS (Mesh.fx)

```hlsl
PS_Output_Single DefaultMaterialPS(VS_Ouput_Tex input)
{
    PS_Output_Single output = (PS_Output_Single) 0;

    float4 color = gBaseTexture.Sample(gBaseSample, input.UV);

    color.rgb *= gMtrlBaseColor.rgb;
    color.a   *= gMtrlOpacity;

    output.Color = color;
    return output;
}
```

- `gBaseTexture.Sample(gBaseSample, UV)`가 실제 텍스처 샘플링. SRV와 샘플러의 만남.
- `gMtrlBaseColor.rgb`를 곱해서 색조를 입힌다. (1,1,1,1)이면 원색 유지.
- `gMtrlOpacity`를 알파에 곱해서 투명도 제어.

`MaterialPixelShader`는 이 PS 엔트리(`DefaultMaterialPS`)만 컴파일해서
`ID3D11PixelShader`로 감싼 별도 리소스다. `StaticMeshShader`는 VS+PS를 모두 컴파일하지만,
Material 시스템에서는 `StaticMeshShader`의 VS만 쓰고 PS는 `Material`이 지정한 걸로
덮어씌우는 구조다(`Material::SetMaterial` 안에서 `_pixelShader->SetShader()`).

### 1.12 Mesh와 슬롯 — 멀티 머티리얼 대응

```cpp
struct FMeshSlot
{
    FIndexBuffer  _indexBuffer;
    Ptr<Material> _material;
};

class Mesh : public Asset
{
    FVertexBuffer          _vertexBuffer;   // 버텍스는 하나
    std::vector<FMeshSlot> _meshSlots;      // 인덱스+머티리얼은 여러 개
};
```

한 메쉬가 **하나의 버텍스 버퍼**를 공유하고, **여러 인덱스 서브셋**에
각각 다른 머티리얼을 입힐 수 있다. 캐릭터 모델의 몸통/머리/장비를
버텍스 하나로 공유하면서 서로 다른 텍스처를 바르는 전형적인 3D 파이프라인이
여기서 축소판으로 구현되어 있다.

`Mesh::CreateMesh` 시 자동으로 `MATERIAL_MANAGER->CreateMaterialInstance("DefaultMaterial")`을
가져와 슬롯에 채운다. 그래서 Mesh가 만들어지려면 MaterialManager가 살아 있어야 한다.

`Mesh::Render()`는 슬롯 수가 0이면 인덱스 없이 `Draw`, 1개 이상이면 슬롯마다
`IASetIndexBuffer` → `DrawIndexed`를 돌린다.

### 1.13 전체 호출 체인 — 프레임 한 번의 흐름

```
GameEngine::Render
 └─ RenderManager::Render             ← 레이어 순회
     └─ SceneComponent::Render        ← ex. StaticMeshComponent
         └─ _transformCBuffer->Update (VS b0)
         └─ slot._material->SetMaterial()
             ├─ _buffer->Update()           (PS b1)
             ├─ ShaderManager::SetSample()  (s0)
             ├─ _pixelShader->SetShader()   (PS 교체)
             └─ Texture::SetShader()        (t0)
         └─ Mesh::Render()
             └─ IASetVertexBuffers → IASetIndexBuffer → DrawIndexed
         └─ slot._material->ResetMaterial() (t0 ← nullptr)
```

이게 한 장의 텍스처가 화면에 찍히는 전체 호출 스택이다.

---

## Part 2. 응용편 — 실제 코드에서 쓰는 법

### 2.1 시작 세팅 — 리소스 폴더와 `DirectoryManager`

1. 프로젝트 루트에 `Resources/Texture/` 폴더를 만든다.
2. 여기에 `muzi-removebg-preview.png`, `apeach.png` 같은 파일을 넣는다.
3. `DirectoryManager::Init`에 `RegisterPath("Resources")`가 포함돼 있어야 한다.
   이게 없으면 `GetPath("Resources")`가 empty optional을 반환해서
   `LoadTexture`가 false로 떨어진다.

### 2.2 게임 시작 시 텍스처 프리로드

가장 쉬운 방법은 `TextureManager::Init`에서 필요한 것들을 일괄 로드:

```cpp
bool TextureManager::Init()
{
    if (!LoadTexture("muzi",   TEXT("muzi-removebg-preview.png"))) return false;
    if (!LoadTexture("apeach", TEXT("apeach.png")))                return false;
    return true;
}
```

이렇게 하면 이후 `TEXTURE_MANAGER->FindTexture("muzi")` 한 줄로 어디서든 꺼내 쓸 수 있다.

> 💡 프로덕션에서는 레벨 로드 시점에 필요한 텍스처만 모으는 쪽이 맞지만,
> 수업용 프로젝트에서는 Init에서 일괄 로드하는 쪽이 편하다.

### 2.3 액터에 텍스처 입히기 — 가장 흔한 패턴

`Player::Init` 내부를 보자.

```cpp
Ptr<StaticMeshComponent> meshComp = CreateSceneComponent<StaticMeshComponent>("Mesh");
meshComp->SetMesh("TexRect");            // 사각 텍스처 메쉬
meshComp->AddTexture(0, "muzi", 0);       // 슬롯0, "muzi"텍스처, 레지스터 t0

SetRootComponent(meshComp);
meshComp->SetRenderLayer("Default");     // (RenderManager 쓸 때)
```

- `"TexRect"`는 `MeshManager::Init`에서 미리 등록된 사각형(UV 포함) 메쉬다.
- `AddTexture(slot, name, registerNum)`의 인자 의미:
  - `slot`: `FMeshSlot` 인덱스. 일반적으로 0.
  - `name`: `TextureManager`에 등록된 이름.
  - `registerNum`: HLSL의 `Texture2D gBaseTexture : register(t0)`와 맞춰서 0.
- `StaticMeshComponent::AddTexture`는 내부적으로 슬롯의 머티리얼을 찾아
  `Material::AddTexture(textureName, 0)`을 호출한다.

### 2.4 컬러 틴팅 / 투명도 — 머티리얼 파라미터 변경

슬롯 0의 머티리얼을 꺼내서 세터를 호출하면 된다.

```cpp
// 반투명 몬스터
Ptr<StaticMeshComponent> mesh = Cast<SceneComponent, StaticMeshComponent>(_root);
mesh->SetOpacity(0, 0.5f);                   // 슬롯0 머티리얼의 투명도
mesh->SetBaseColor(0, 1.f, 0.3f, 0.3f, 1.f); // 빨간 틴트
```

매 프레임 아무데서나 바꿔도 된다. `Material::SetMaterial`이 드로우 직전에
상수버퍼를 다시 올려주기 때문에 그 프레임부터 바로 반영된다.

**깜빡이 이펙트 (Tick 안에서):**

```cpp
void Player::Tick(float deltaTime)
{
    Pawn::Tick(deltaTime);

    if (_opacity >= 1.f)       reverse = true;
    else if (_opacity <= 0.1f) reverse = false;

    _opacity += reverse ? -deltaTime : deltaTime;

    Ptr<StaticMeshComponent> mesh = Cast<SceneComponent, StaticMeshComponent>(_root);
    mesh->SetOpacity(0, _opacity);
}
```

### 2.5 텍스처 런타임 교체 — 히트 시 색 반전 같은 것

`Material::AddTexture`로 추가한 정보를 나중에 바꾸고 싶을 수 있다.
가장 단순한 방법은 **머티리얼 인스턴스를 새로 만들어 갈아끼우는 것**:

```cpp
Ptr<Material> newMat = MATERIAL_MANAGER->CreateMaterialInstance("DefaultMaterial");
newMat->AddTexture("apeach", 0);
newMat->SetBaseColor(FVector4D(2.f, 2.f, 2.f, 1.f)); // 1.0 초과 = 밝기 부스트
mesh->SetMaterial(0, newMat);
```

"피격 시 흰색 번쩍" 같은 건 이렇게 머티리얼을 통째로 교체하는 쪽이 깔끔하다.

### 2.6 샘플러 바꾸기 — 픽셀 아트는 POINT로

기본은 LINEAR라서 저해상도 스프라이트가 뿌옇게 나온다. 픽셀 아트라면:

```cpp
Ptr<Material> mat = MATERIAL_MANAGER->CreateMaterialInstance("DefaultMaterial");
mat->SetSamplerType(eTextureSampleType::TEXTURE_SAMPLE_POINT);
mat->AddTexture("player_pixel", 0);
mesh->SetMaterial(0, mat);
```

`SetSamplerType`은 머티리얼 안에만 저장되고, 실제 `PSSetSamplers`는
`Material::SetMaterial`에서 `ShaderManager::SetSample(_sampleType)`을 호출할 때 일어난다.

### 2.7 다중 텍스처 바인딩 (멀티 텍스처링 준비)

HLSL 쪽에 두 번째 텍스처를 추가하면:

```hlsl
Texture2D gBaseTexture  : register(t0);
Texture2D gDetailTexture: register(t1);
```

C++에서는:

```cpp
material->AddTexture("muzi",        0);  // t0
material->AddTexture("noise_detail", 1); // t1
```

이렇게 두 번 부르면 `Material::_textures`에 엔트리 2개가 쌓이고,
`SetMaterial` 루프가 두 SRV를 모두 바인딩한다.

> ⚠️ `Material::AddTexture`가 `_buffer->SetTextureWidth/Height`를 호출한다.
> 두 번째 텍스처를 추가하면 width/height가 그쪽으로 덮어쓰기된다.
> 두 텍스처 해상도가 다르면 HLSL의 `gMtrlTextureWidth`는 나중에 추가된
> 쪽 값을 갖게 된다. 첫 텍스처 사이즈가 중요하다면 추가 순서를 주의하거나
> `SetTextureWidth/Height`를 수동으로 다시 불러준다.

### 2.8 커스텀 픽셀 쉐이더 붙이기

예컨대 그레이스케일 PS를 만들고 싶다면:

1. `Mesh.fx`에 엔트리 추가

```hlsl
PS_Output_Single GrayscalePS(VS_Ouput_Tex input)
{
    float4 color = gBaseTexture.Sample(gBaseSample, input.UV);
    float gray = dot(color.rgb, float3(0.299, 0.587, 0.114));
    color.rgb = float3(gray, gray, gray);
    color.a  *= gMtrlOpacity;
    PS_Output_Single output;
    output.Color = color;
    return output;
}
```

2. 새로운 Shader 클래스 `GrayscalePixelShader`를 `MaterialPixelShader`처럼 만들어서
   `LoadPixelShader("GrayscalePS", "Mesh.fx")`로 컴파일.

3. `ShaderManager::Init`에 등록

```cpp
CreateShader<GrayscalePixelShader>("GrayscalePixelShader");
```

4. 머티리얼 생성 시 사용

```cpp
MATERIAL_MANAGER->CreateMaterial(
    "GrayMaterial",
    "GrayscalePixelShader",
    eTextureSampleType::TEXTURE_SAMPLE_LINEAR);

Ptr<Material> m = MATERIAL_MANAGER->CreateMaterialInstance("GrayMaterial");
m->AddTexture("muzi", 0);
mesh->SetMaterial(0, m);
```

이게 "새 쉐이더 효과를 프로젝트에 붙이는" 표준 절차다.

### 2.9 자주 보는 함정과 디버깅 체크리스트

| 증상 | 의심 원인 |
|---|---|
| **화면이 완전히 검정** | `SetMaterial`에서 `_pixelShader == nullptr`. `CreateMaterial`의 psName 오타 확인. |
| **텍스처가 흰색 사각형으로만 보임** | SRV는 바인딩됐지만 샘플이 실패. UV가 전부 0이거나 TEXCOORD 입력 레이아웃이 빠진 경우. |
| **텍스처가 뒤집혀 보임** | DirectX의 UV 원점은 좌상단. PNG 자체는 좌상단 원점이라 정상이지만, 메쉬 정의에서 V를 반대로 줬을 수 있음. `TexRect`의 UV 확인. |
| **반투명이 안 먹힘** | `RenderManager`가 `AlphaBlend` state를 거는지 확인. 또는 `_opacity < 1`이지만 BlendState가 없으면 그냥 불투명으로 찍힘. |
| **엉뚱한 텍스처가 찍힘** | 이전 드로우의 `Material::ResetMaterial`이 호출되지 않아 SRV가 남아 있음. |
| **빌드 에러 `LNK2019: CreateShaderResourceView`** | DirectXTex lib 경로/이름 확인. Debug/Release에 맞는 lib이 링크되는지. |
| **런타임에 크래시 in `Material::_buffer`** | `ShaderManager::Init`이 `AssetManager::Init`보다 나중에 불림. 순서 반대로. |
| **`.png`는 되는데 `.dds`만 실패** | `DirectoryManager::IsExtension` 버그 버전일 가능성. `compare()` 반환값 확인. |

### 2.10 확장 아이디어

이 시스템을 기반으로 쉽게 확장할 수 있는 것들:

- **스프라이트 애니메이션**: UV를 상수버퍼로 넘겨서 매 프레임 offset을 바꾸면
  하나의 스프라이트 시트에서 여러 프레임을 재생할 수 있다. KDT6_DX의
  `Animation2D` 시스템이 정확히 이 방향이다.
- **팔레트 스왑**: 두 번째 텍스처 슬롯에 LUT(look-up table)를 꽂고,
  PS에서 원본 픽셀을 LUT 좌표로 사용해 색을 재매핑. "같은 스프라이트, 다른 색"
  몬스터 바리에이션에 쓴다.
- **아웃라인**: 두 번 그린다. 첫 번째는 약간 확대 + 단색으로, 두 번째는 원본으로.
  `Material`을 두 개 준비해 `Mesh::Render` 전에 아웃라인 쪽을 먼저 렌더.
- **노멀 맵 라이팅**: 2D에서도 픽셀 단위 라이팅이 가능. 노멀 텍스처를 `t1`에 꽂고
  PS에서 라이트 방향과 내적. 이건 cbuffer에 라이트 정보를 추가해야 한다.
- **디졸브/페이드**: 노이즈 텍스처를 `t1`에 꽂고, cbuffer에 `dissolve threshold`를 넘긴 뒤
  PS에서 `if (noise.r < threshold) discard;`. 메탈기어 스타일 페이드 아웃.

모든 확장은 "새 HLSL 엔트리 + 새 Shader 래퍼 + `ShaderManager::Init` 등록 +
`MaterialManager::CreateMaterial`"의 4단계 패턴을 따른다. 이 패턴만 몸에 익혀두면
이펙트를 프로젝트에 붙이는 속도가 현저히 빨라진다.

---

## 부록 A. 초기화 의존성 요약

```
DirectoryManager (Resources 경로)
        ↓
Device            (ID3D11Device/Context)
        ↓
ShaderManager     ← MaterialCBuffer 등록, Material을 b1로 생성, 샘플러 생성
        ↓
AssetManager
 ├─ TextureManager   (PNG 로드 → SRV)
 ├─ MaterialManager  (ShaderManager의 Material cbuffer 참조)
 └─ MeshManager      (MaterialManager의 DefaultMaterial 참조)
        ↓
RenderManager      (레이어, BlendState, DepthStencilState)
        ↓
World / Level / Actor
```

**순서를 지키지 않으면 조용히 망가지는 지점**:

- `AssetManager` < `ShaderManager` → `Material::_buffer == nullptr`. 렌더는 되지만
  컬러/투명도/사이즈가 전부 0 또는 쓰레기값으로 동작.
- `Mesh` < `Material` → `Mesh::CreateMesh`에서 `MATERIAL_MANAGER`가 nullptr이라 크래시.
- `Material` < `Texture` → `Material::AddTexture(name, ...)`이 `FindTexture`로
  nullptr을 받아 조용히 추가가 실패.

## 부록 B. HLSL 레지스터 슬롯 한눈에

| 자원 종류 | 접두 | VS | PS | KDT6_DX 할당 |
|---|---|---|---|---|
| Constant Buffer | b | b0: Transform | b0: Color, b1: Material | b0/b1 |
| Shader Resource (텍스처) | t | — | t0: gBaseTexture | t0 |
| Sampler | s | — | s0: gBaseSample | s0 |

VS와 PS는 **slot이 분리**되어 있어서 VS의 `b0`(Transform)와 PS의 `b0`(Color)는
충돌하지 않는다. 단 같은 스테이지 안에서는 슬롯이 유일해야 한다.

## 부록 C. 파일 목록

**Core** — 에셋/매니저 레이어
- `Texture.h/.cpp` — 텍스처 로드·SRV 생성·바인딩
- `TextureManager.h/.cpp` — 이름 기반 레지스트리
- `Material.h/.cpp` — 텍스처+쉐이더+샘플러 묶음
- `MaterialManager.h/.cpp` — 원본 머티리얼 관리 + Clone 팩토리

**Shader** — 쉐이더/상수버퍼 레이어
- `MaterialCBuffer.h/.cpp` — `FMaterialCBufferData` CPU→GPU 어댑터
- `MaterialPixelShader.h/.cpp` — 머티리얼 전용 PS
- `StaticMeshShader.h/.cpp` — VS + PS + 입력 레이아웃
- `CBufferData.h` — `FMaterialCBufferData` 구조체 정의
- `ShaderManager.h/.cpp` — 샘플러 생성, Material cbuffer 등록

**HLSL**
- `Share.fx` — 공용 cbuffer 선언 + `gBaseTexture`/`gBaseSample` 선언
- `Mesh.fx` — `MaterialMeshVS` + `DefaultMaterialPS` 엔트리

**Common**
- `Info.h` — `eTextureSampleType`, `eAssetType::TEXTURE/MATERIAL`, `FVertexTexture`
