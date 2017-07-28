import React from 'react';
import PropTypes from 'prop-types';
import url from 'url';

export default class AppPermission extends React.Component {
    constructor(props) {
        super(props);

        const curlBase = this.getCurlBase();
        this.state = { curlBase: curlBase};
    }

    // Return string representation of content URL without query parameters
    getCurlBase() {
        const wurl = url.parse(this.props.url);
        let curl;
        let curlString;

        const searchParams = new URLSearchParams(wurl.search);

        if(searchParams && searchParams.get('url')) {
            curl = url.parse(searchParams.get('url'));
            if(curl) {
                curl.search = curl.query = "";
                curlString = curl.format();
            }
        }
        if (!curl && wurl) {
            wurl.search = wurl.query = "";
            curlString = wurl.format();
        }
        return curlString;
    }

    render() {
        return (
            <div className='mx_AppPermissionWarning'>
                <div className='mx_AppPermissionWarningImage'>
                    <img src='img/warning.svg' alt='Warning'/>
                </div>
                <div className='mx_AppPermissionWarningText'>
                    <span className='mx_AppPermissionWarningTextLabel'>Do you want to load widget from URL:</span> <span className='mx_AppPermissionWarningTextURL'>{this.state.curlBase}</span>
                </div>
                <input
                    className='mx_AppPermissionButton'
                    type='button'
                    value='Allow'
                    onClick={this.props.onPermissionGranted}
                />
            </div>
        );
    }
}

AppPermission.propTypes = {
    url: PropTypes.string.isRequired,
    onPermissionGranted: PropTypes.func.isRequired,
};
AppPermission.defaultProps = {
    onPermissionGranted: function() {},
};
