import { BUILDS, buildOf, HEIGHTS, heightOf,tieColorOf, CLOTHES, COLOR_PRESETS, COMPANIONS, EARRINGS, earringsOf, earColorOf, HEADPHONES, headphonesOf, WATCHES, WATCH_FACES, watchOf, FACE, frameColorOf, HAIR, HAT_STYLES, SHOE_STYLES, SOCKS, TATTOO_PARTS, TATTOO_STYLES,clothesOf, companionOf, faceOf, hairOf, hatOf, lensOf, shoeOf, socksOf, tattooOf, type Look } from '@/src/content/catalog';
import ColorField from './ColorField';
import HairLengthField from './HairLengthField';
import LensOpacityField from './LensOpacityField';

function Pick({ name, label, value, options }: { name: string; label: string; value: string; options: { value: string; label: string }[] }) {
  return (
    <fieldset className="pick">
      <legend>{label}</legend>
      {options.map(o => (
        <label key={o.value}><input type="radio" name={name} value={o.value} defaultChecked={o.value === value} /><span>{o.label}</span></label>
      ))}
    </fieldset>
  );
}

// the 捏臉 fields shared by the regulars' editor and the owner's page; parseLook() reads them back
// prefix: the field names' prefix (the regulars' second look, 第二套捏臉, is LOOK2)
export default function LookFields({ look, seed, prefix: px = '' }: { look: Look; seed: string; prefix?: string }) {
  const f = faceOf(look, seed);
  const hat = hatOf(look), hair = hairOf(look), clothes = clothesOf(look), shoe = shoeOf(look), socks = socksOf(look), tattoo = tattooOf(look), ears = earringsOf(look), lens = lensOf(look), phones = headphonesOf(look), watch = watchOf(look);
  const earsOn = ears.left !== 'none' || ears.right !== 'none';
  return (
    <>
      <section className="panel-block">
        <h2>捏臉</h2>
        <div className="colors">
          <ColorField name={px + 'skin'} label="膚色" value={look.skin} presets={COLOR_PRESETS.skin} />
          <ColorField name={px + 'eyeColor'} label="瞳色" value={f.eyeColor} presets={COLOR_PRESETS.eyes} />
        </div>
        <label className="check"><input type="checkbox" name={px + 'blush'} defaultChecked={f.blush} /><span>腮紅</span></label>
        <Pick name={px + 'height'} label="身高" value={heightOf(look)} options={HEIGHTS} />
        <Pick name={px + 'build'} label="身形" value={buildOf(look)} options={BUILDS} />
        <Pick name={px + 'faceShape'} label="臉型" value={f.faceShape} options={FACE.faceShape} />
        <Pick name={px + 'eyes'} label="眼睛" value={f.eyes} options={FACE.eyes} />
        <Pick name={px + 'brows'} label="眉毛" value={f.brows} options={FACE.brows} />
        <Pick name={px + 'nose'} label="鼻子" value={f.nose} options={FACE.nose} />
        <Pick name={px + 'mouth'} label="嘴巴" value={f.mouth} options={FACE.mouth} />
        <Pick name={px + 'facialHair'} label="鬍子" value={f.facialHair} options={FACE.facialHair} />
        <Pick name={px + 'beard'} label="鬍子濃淡" value={f.beard} options={FACE.beard} />
      </section>

      <section className="panel-block look-block">
        <h2>髮型</h2>
        <HairLengthField length={hair.length} cm={hair.cm} prefix={px} />
        <Pick name={px + 'hairCurl'} label="髮質" value={hair.curl} options={HAIR.curl} />
        <Pick name={px + 'hairFront'} label="前額" value={hair.front} options={HAIR.front} />
        <Pick name={px + 'hairTie'} label="綁髮（中長髮、長髮）" value={hair.tie} options={HAIR.tie} />
        <div className="colors">
          <ColorField name={px + 'hair'} label="髮色" value={look.hair} presets={COLOR_PRESETS.hair} />
          <ColorField name={px + 'tieColor'} label="髮帶顏色" value={tieColorOf(look)} presets={COLOR_PRESETS.clothes} />
        </div>
      </section>

      <section className="panel-block look-block">
        <h2>帽子</h2>
        <Pick name={px + 'hat'} label="帽子" value={hat.hat} options={HAT_STYLES} />
        <div className="colors">
          <ColorField name={px + 'hatColor'} label="帽子顏色" value={hat.color} presets={COLOR_PRESETS.clothes} />
        </div>
      </section>

      <section className="panel-block look-block">
        <h2>眼鏡</h2>
        <Pick name={px + 'glasses'} label="眼鏡" value={f.glasses} options={FACE.glasses} />
        <Pick name={px + 'glassesShape'} label="鏡框造型" value={f.glassesShape} options={FACE.glassesShape} />
        <div className="colors">
          <ColorField name={px + 'frameColor'} label="鏡框顏色" value={frameColorOf(look, f.glasses)} presets={COLOR_PRESETS.frame} />
          <ColorField name={px + 'lensColor'} label="鏡片顏色" value={lens.color} presets={COLOR_PRESETS.lens} />
          <LensOpacityField value={lens.opacity} prefix={px} />
        </div>
      </section>

      <section className="panel-block look-block">
        <h2>飾品</h2>
        <p className="hint">可以同時戴好幾樣：勾選要戴的，再設定樣式和顏色。</p>
        <div className="acc-list">
          <input type="hidden" name={px + 'acc'} value="1" />
          <div className="acc-row">
            <label className="check acc-name"><input type="checkbox" name={px + 'acc_earrings'} defaultChecked={earsOn} /><span>耳環</span></label>
            <div className="acc-body">
              {/* (ticked with nothing chosen yet: a hoop in the right ear to start with) */}
              <Pick name={px + 'earR'} label="右耳" value={earsOn ? ears.right : 'hoop'} options={EARRINGS} />
              <Pick name={px + 'earL'} label="左耳" value={ears.left} options={EARRINGS} />
              <div className="colors"><ColorField name={px + 'earColor'} label="耳環顏色" value={earColorOf(look)} presets={COLOR_PRESETS.metal} /></div>
            </div>
          </div>
          <div className="acc-row">
            <label className="check acc-name"><input type="checkbox" name={px + 'acc_headphones'} defaultChecked={phones.wear !== 'none'} /><span>耳機</span></label>
            <div className="acc-body">
              <Pick name={px + 'headphonesWear'} label="戴法" value={phones.wear === 'none' ? 'head' : phones.wear} options={HEADPHONES} />
              <div className="colors"><ColorField name={px + 'headphoneColor'} label="耳機顏色" value={phones.color} presets={COLOR_PRESETS.clothes} /></div>
            </div>
          </div>
          <div className="acc-row">
            <label className="check acc-name"><input type="checkbox" name={px + 'acc_watch'} defaultChecked={watch.wrist !== 'none'} /><span>手錶</span></label>
            <div className="acc-body">
              <Pick name={px + 'watchWrist'} label="戴在" value={watch.wrist === 'none' ? 'left' : watch.wrist} options={WATCHES} />
              <Pick name={px + 'watchFace'} label="錶面" value={watch.face} options={WATCH_FACES} />
              <div className="colors">
                <ColorField name={px + 'watchColor'} label="錶帶顏色" value={watch.color} presets={COLOR_PRESETS.clothes} />
                <ColorField name={px + 'watchDial'} label="錶面顏色" value={watch.dial} presets={COLOR_PRESETS.dial} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="panel-block look-block">
        <h2>上衣</h2>
        <Pick name={px + 'topStyle'} label="上衣" value={clothes.style} options={CLOTHES.style} />
        <Pick name={px + 'topPattern'} label="上衣圖樣" value={clothes.pattern} options={CLOTHES.pattern} />
        <Pick name={px + 'topFit'} label="上衣版型" value={clothes.top} options={CLOTHES.top} />
        <Pick name={px + 'sleeve'} label="袖長" value={clothes.sleeve} options={CLOTHES.sleeve} />
        <div className="colors">
          <ColorField name={px + 'shirt'} label="上衣顏色" value={look.shirt} presets={COLOR_PRESETS.clothes} />
          <label className="short">背號<input name={px + 'number'} defaultValue={look.number ?? ''} maxLength={2} placeholder="無" /></label>
        </div>
      </section>

      <section className="panel-block look-block">
        <h2>下身</h2>
        <Pick name={px + 'bottom'} label="下身" value={clothes.bottom} options={CLOTHES.bottom} />
        <Pick name={px + 'pantsFit'} label="下身寬度（長褲、短褲、裙子）" value={clothes.fit} options={CLOTHES.fit} />
        <div className="colors">
          <ColorField name={px + 'pants'} label="褲子／裙子" value={look.pants} presets={COLOR_PRESETS.clothes} />
        </div>
      </section>

      <section className="panel-block look-block">
        <h2>鞋子</h2>
        <Pick name={px + 'shoeStyle'} label="鞋子" value={shoe.style} options={SHOE_STYLES} />
        <Pick name={px + 'socks'} label="襪子（短褲、裙子、拖鞋看得到）" value={socks.style} options={SOCKS} />
        <div className="colors">
          <ColorField name={px + 'shoe'} label="鞋子顏色" value={shoe.color} presets={COLOR_PRESETS.clothes} />
          <ColorField name={px + 'sock'} label="襪子顏色" value={socks.color} presets={COLOR_PRESETS.clothes} />
        </div>
      </section>

      <section className="panel-block look-block">
        <h2>刺青</h2>
        <fieldset className="pick tattoos">
          <legend>每個部位各選風格；小腿穿短褲、裙子才看得到</legend>
          {TATTOO_PARTS.map(p => (
            <label key={p.value}>{p.label}
              <select name={px + 'tat_' + p.value} defaultValue={tattoo[p.value] ?? 'none'}>
                {TATTOO_STYLES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
          ))}
          <label>刺青文字（選「文字」的部位）<input name={px + 'tattooText'} defaultValue={typeof look.tattooText === 'string' ? look.tattooText : ''} maxLength={12} placeholder="PEEP" /></label>
        </fieldset>
      </section>

      <section className="panel-block look-block">
        <h2>配件</h2>
        <Pick name={px + 'companion'} label="配件" value={companionOf(look)} options={COMPANIONS} />
      </section>
    </>
  );
}

