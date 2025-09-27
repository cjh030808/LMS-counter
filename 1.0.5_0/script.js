// 'time' 이벤트는 비디오 재생 중 정해진 간격(ex. 250ms) 마다 호출됨.
// callback parameter 로 event 객체가 전달됨.
jwplayer().off('time')
jwplayer().on('time', function (callback) {
    seek_position.current = callback.position;
});

// window 의 URL 을 객체로 받아와서 쿼리 파라미터로 적힌 id 값을 가져옴
const url = new URL(window.location.href)
const lecId = url.searchParams.get("id")

function videoSpeedClick(){
    // jwplayer_speed(document.querySelector('#playBackRate').value) # not working since 2025-09-10.
    // CJH - jwplayer.setPlaybackRate(rate) -> 0.25 ~ 4 배속만 지원하므로 아래 로직이 유리함
    document.querySelector('video').playbackRate = document.querySelector('#playBackRate').value
}

function tabCloseClick(){
    // document.querySelector(".bookmark").style.display = "none"
    $(".bookmark").hide()
}

function tabOpenClick(){
    // document.querySelector(".bookmark").style.display = "block"
    $(".bookmark").show()
}

function bookmarkRemoveClick(idx){
    console.log($(".bookmark .mark"))
    $(".bookmark .mark")[idx].style.display = "none"
    let currentBookmark = JSON.parse(localStorage.getItem(`bookmark`))
    removedBookmark = currentBookmark[lecId].splice(idx, 1)
    localStorage.setItem(`bookmark`, JSON.stringify(currentBookmark));
}

// CJH - videoTag is deprecated since 2025-09-27. 
function bookmarkClick(){
    const player = jwplayer();
    let currentBookmark = JSON.parse(localStorage.getItem(`bookmark`))

    // videoTag.pause()
    player.pause();
    // pause 를 synchronize하게 안정적으로 처리하기 위한 setTimeout
    setTimeout(() => {
        let memo = prompt("Bookmark를 알아보기 위한 메모를 적어두세요!", "memo");

        // videoTag.play()
        player.play();

        if(memo === "") {
            alert("memo는 꼭 적으셔야 합니다!");
        } else if(memo != null) {
            const currentTime = player.getPosition(); 
            currentBookmark[lecId].push({"time": currentTime, "memo": memo});
            localStorage.setItem(`bookmark`, JSON.stringify(currentBookmark));

            $(".bookmark").append(`
            <div class="mark">
                <button class="bookmark_remove" onclick="bookmarkRemoveClick(${currentBookmark[lecId].length - 1})">
                    <img src="/mod/vod/pix/layer/viewer-close.png" />
                </button> <br>
                <div onclick="onTimeLineClick(${currentTime});" value=${currentTime}>
                    <span class="memo">${memo}</span> <br>
                    <span class="time">${parseInt(currentTime/3600)} : ${parseInt(currentTime/60%60).toString().padStart(2, "0")} :  ${parseInt(currentTime%60).toString().padStart(2, "0")}</span>
                </div>
            </div>`);
        }
    }, 50); // 50ms 정도의 짧은 지연을 주어 안정적으로 처리
}

function onTimeLineClick(e){
    // videoTag.currentTime = e
    jwplayer().seek(e);
}

$("#vod_header .vod_help").hide()
// $().insertAfter($("#vod_header .vod_close"))

$("#vod_header .vod_close").after(`
<div class="triangle" onclick="tabOpenClick()"></div>
`)

$("#vod_viewer").append(`
    <div class="bookmark">
    <button class="bookmark_close" onclick="tabCloseClick()">
    <img src="/mod/vod/pix/layer/viewer-close.png" />
    </button>
    <div>
`)

let currentBookmark = JSON.parse(localStorage.getItem(`bookmark`))
if(currentBookmark == null) currentBookmark = {}
if(currentBookmark[lecId] == undefined) currentBookmark[lecId] = []
localStorage.setItem(`bookmark`, JSON.stringify(currentBookmark));

currentBookmark[lecId].map((obj, idx)=>{
    $(".bookmark").append(`
    <div class="mark">
    <button class="bookmark_remove" onclick="bookmarkRemoveClick(${idx})">
    <img src="/mod/vod/pix/layer/viewer-close.png" />
    </button> <br>
    <div onclick="onTimeLineClick(${obj.time});" value=${obj.time}>
    <span class="memo">${obj.memo}</span> <br>
    <span class="time">${parseInt(obj.time/3600)} : ${parseInt(obj.time/60%60).toString().padStart(2, "0")} :  ${parseInt(obj.time%60).toString().padStart(2, "0")}</span>
    </div></div>`)
})

$("#vod_footer").append(`
    <div class="playBack-container">
    <button onclick="bookmarkClick()">Bookmark</button>
    <span>재생 속도 : </span>
    <input type="text" id="playBackRate" value="1">
    <button onclick="videoSpeedClick()">Apply</button>
    </div>
`)

console.log($(".bookmark .mark:nth-of-type(1)"))

// CJH - LMS sound 증폭 기능. 25.09.27
/**
 * JW Player 인스턴스를 받아 사운드 증폭 기능을 연결하는 메인 함수
 * @param {object} playerInstance - jwplayer() 인스턴스
 */
function attachSoundBooster(playerInstance) {
    console.log("Attaching sound booster to player:", playerInstance.id);

    const player = playerInstance;
    const playerId = player.id;
    const MAX_BOOST_LEVEL = 2.0;

    let gainNode;
    let isAudioContextInitialized = false;
    let volumeUpdateGuard = false;


    // Web Audio API를 사용하여 오디오 출력을 가로채고 증폭기를 연결하는 함수.
    function initializeAudioBooster() {
        if (isAudioContextInitialized) return;
        
        try {
            const videoElement = document.querySelector(`#${playerId} video`);
            if (!videoElement) {
                console.error("JW Player의 video 요소를 찾을 수 없습니다.");
                return;
            }

            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            gainNode = audioContext.createGain();
            const source = audioContext.createMediaElementSource(videoElement);
            source.connect(gainNode);
            gainNode.connect(audioContext.destination);

            isAudioContextInitialized = true;
            console.log("Volume booster initialized successfully.");
            
            const defaultLogicalVolume = 50;
            updateBoosterVolume(defaultLogicalVolume); // 오디오 엔진을 50%에 맞게 설정 (실제 소리 100%)

            player.setVolume(defaultLogicalVolume);

        } catch (e) {
            console.error("Failed to initialize volume booster:", e);
        }
    }


    // JW Player 볼륨 값(0-100)을 받아서 GainNode 볼륨으로 변환 및 적용하는 함수

    function updateBoosterVolume(jwVolume) {
        if (!isAudioContextInitialized) return;
        const newGainValue = (jwVolume / 100) * MAX_BOOST_LEVEL;
        gainNode.gain.value = newGainValue;
        if (player.getVolume() !== 100) {
            volumeUpdateGuard = true;
            player.setVolume(100);
        }
    }
    player.once('firstFrame', initializeAudioBooster);

    player.on('volume', (event) => {
        if (volumeUpdateGuard) { volumeUpdateGuard = false; return; }
        updateBoosterVolume(event.volume);
    });

    player.on('mute', (event) => {
        if (!isAudioContextInitialized) return;
        gainNode.gain.value = event.mute ? 0 : (player.getVolume() / 100) * MAX_BOOST_LEVEL;
    });
}

try {
    const playerInstance = jwplayer();
    if (playerInstance && playerInstance.getState() !== 'IDLE') {
        attachSoundBooster(playerInstance);
    } else {
        jwplayer().on('ready', function() {
            attachSoundBooster(this);
        });
    }
} catch (e) {
    console.error("JW Player not found or failed to initialize:", e);
}